import type Stripe from "stripe";
import { db } from "@/lib/db";
import {
  MembershipStatus,
  OrderStatus,
  PaymentKind,
  PaymentStatus,
  DunningOutcome,
  RegistrationStatus,
} from "@prisma/client";

/** Map a Stripe subscription status onto our MembershipStatus enum. */
function mapSubStatus(s: Stripe.Subscription.Status): MembershipStatus {
  switch (s) {
    case "active":
      return MembershipStatus.active;
    case "trialing":
      return MembershipStatus.trialing;
    case "past_due":
      return MembershipStatus.past_due;
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return MembershipStatus.canceled;
    default:
      return MembershipStatus.incomplete; // incomplete, paused
  }
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function upsertMembershipFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const orgId = sub.metadata?.orgId;
  const item = sub.items.data[0];

  // Prefer tierId from checkout metadata; fall back to resolving by the price id
  // (covers portal-initiated plan changes where metadata is stale/absent).
  let tierId: string | undefined = sub.metadata?.tierId;
  if (!tierId && item?.price?.id) {
    const matched = await db.tier.findFirst({
      where: {
        OR: [{ stripePriceMonthlyId: item.price.id }, { stripePriceYearlyId: item.price.id }],
      },
    });
    tierId = matched?.id;
  }
  if (!userId || !orgId || !tierId) return;

  // In recent API versions billing periods live on the item; fall back to the sub.
  const periodEndUnix: number | undefined =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  const recurringInterval = item?.price?.recurring?.interval;
  const interval = recurringInterval === "year" ? "year" : "month";
  const customerId = idOf(sub.customer);

  const data = {
    status: mapSubStatus(sub.status),
    interval: interval as "month" | "year",
    currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    stripeSubscriptionId: sub.id,
    tierId,
  };

  await db.membership.upsert({
    where: { userId_orgId: { userId, orgId } },
    create: { userId, orgId, ...data, stripeCustomerId: customerId },
    update: data,
  });
}

async function markOrderPaid(opts: {
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  feeAmount?: number | null;
}) {
  const order = opts.checkoutSessionId
    ? await db.order.findUnique({ where: { stripeCheckoutSessionId: opts.checkoutSessionId } })
    : opts.paymentIntentId
      ? await db.order.findFirst({ where: { stripePaymentIntentId: opts.paymentIntentId } })
      : null;
  if (!order) return;
  if (order.status === OrderStatus.paid) return; // idempotent — already recorded

  await db.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.paid,
      stripePaymentIntentId: opts.paymentIntentId ?? order.stripePaymentIntentId,
      applicationFeeAmount: opts.feeAmount ?? order.applicationFeeAmount,
    },
  });
  await db.payment.create({
    data: {
      userId: order.userId,
      kind: PaymentKind.one_time,
      amount: order.amount,
      currency: order.currency,
      applicationFeeAmount: opts.feeAmount ?? order.applicationFeeAmount,
      stripePaymentIntentId: opts.paymentIntentId ?? order.stripePaymentIntentId,
      status: PaymentStatus.succeeded,
    },
  });
}

async function confirmRegistration(registrationId: string, paymentIntentId: string | null) {
  const reg = await db.registration.findUnique({ where: { id: registrationId } });
  if (!reg || reg.status === RegistrationStatus.confirmed || reg.status === RegistrationStatus.refunded) {
    return;
  }
  await db.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.confirmed, stripePaymentIntentId: paymentIntentId },
  });
  await db.payment.create({
    data: {
      userId: reg.userId,
      kind: PaymentKind.one_time,
      amount: reg.amount ?? 0,
      currency: "eur",
      stripePaymentIntentId: paymentIntentId,
      status: PaymentStatus.succeeded,
    },
  });
}

/**
 * Apply a verified Stripe event to the database. Idempotency is enforced by the
 * caller (WebhookEvent table). Best-effort: unknown/irrelevant events are ignored.
 */
export async function syncStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertMembershipFromSubscription(event.data.object as Stripe.Subscription);
      break;
    }

    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "payment") {
        if (s.metadata?.registrationId) {
          await confirmRegistration(s.metadata.registrationId, idOf(s.payment_intent));
        } else {
          await markOrderPaid({ checkoutSessionId: s.id, paymentIntentId: idOf(s.payment_intent) });
        }
      }
      // subscription mode is handled by the customer.subscription.* events.
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = idOf((inv as unknown as { subscription?: string | { id: string } }).subscription ?? null);
      if (subId) {
        const membership = await db.membership.findUnique({
          where: { stripeSubscriptionId: subId },
        });
        if (membership) {
          await db.payment.create({
            data: {
              userId: membership.userId,
              kind: PaymentKind.subscription,
              amount: inv.amount_paid ?? 0,
              currency: inv.currency ?? "eur",
              applicationFeeAmount:
                (inv as unknown as { application_fee_amount?: number | null }).application_fee_amount ?? null,
              stripeInvoiceId: inv.id,
              status: PaymentStatus.succeeded,
            },
          });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = idOf((inv as unknown as { subscription?: string | { id: string } }).subscription ?? null);
      if (subId) {
        const membership = await db.membership.findUnique({
          where: { stripeSubscriptionId: subId },
        });
        if (membership) {
          await db.membership.update({
            where: { id: membership.id },
            data: { status: MembershipStatus.past_due },
          });
          const attempts = await db.dunningAttempt.count({ where: { membershipId: membership.id } });
          await db.dunningAttempt.create({
            data: {
              membershipId: membership.id,
              attemptNumber: attempts + 1,
              outcome: DunningOutcome.pending,
            },
          });
          // TODO(content): send dunning recovery email via Resend.
        }
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await markOrderPaid({ paymentIntentId: pi.id });
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId = idOf(charge.payment_intent);
      if (piId) {
        await db.payment.updateMany({
          where: { stripePaymentIntentId: piId },
          data: { status: PaymentStatus.refunded },
        });
        await db.order.updateMany({
          where: { stripePaymentIntentId: piId },
          data: { status: OrderStatus.refunded },
        });
      }
      break;
    }

    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      const status = acct.charges_enabled
        ? "active"
        : acct.details_submitted
          ? "pending"
          : "onboarding";
      await db.organization.updateMany({
        where: { stripeConnectedAccountId: acct.id },
        data: { stripeAccountStatus: status },
      });
      break;
    }

    default:
      // Unhandled event types are acknowledged and ignored.
      break;
  }
}
