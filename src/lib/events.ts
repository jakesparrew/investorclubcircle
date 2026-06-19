"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { stripe, onAccount, APP_FEE_PERCENT } from "@/lib/stripe";
import { optionalEnv } from "@/lib/env";
import { notify } from "@/lib/notify";

function appUrl() {
  return optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
}

/** Register the current user for an event: member deposit (€1), paid ticket, free, or waitlist. */
export async function registerForEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  const event = await db.event.findUnique({ where: { id: eventId }, include: { org: true } });
  if (!event || event.status !== "published") throw new Error("Event niet beschikbaar");

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(event)).ok) throw new Error("Geen toegang tot dit event");

  const existing = await db.registration.findUnique({
    where: { eventId_userId: { eventId, userId: session.user.id } },
  });
  if (existing) redirect(`/events/${event.slug}`);

  const member = await db.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["active", "trialing"] } },
  });

  let type: "deposit" | "paid" | "free" = "free";
  let amount = 0;
  if (member && event.depositAmount && event.depositAmount > 0) {
    type = "deposit";
    amount = event.depositAmount;
  } else if (!member && event.nonMemberPrice && event.nonMemberPrice > 0) {
    type = "paid";
    amount = event.nonMemberPrice;
  }

  // Decide capacity vs waitlist and create the registration atomically (prevents overbooking).
  const result = await db.$transaction(
    async (tx) => {
      const activeCount = await tx.registration.count({
        where: { eventId, status: { in: ["confirmed", "pending"] } },
      });
      if (event.capacity && activeCount >= event.capacity) {
        const waitCount = await tx.registration.count({ where: { eventId, status: "waitlisted" } });
        await tx.registration.create({
          data: {
            eventId,
            userId: session.user.id,
            type: "free",
            status: "waitlisted",
            waitlistPosition: waitCount + 1,
            checkinToken: randomUUID(),
          },
        });
        return { waitlisted: true as const, registration: null };
      }
      const registration = await tx.registration.create({
        data: {
          eventId,
          userId: session.user.id,
          type,
          status: amount > 0 ? "pending" : "confirmed",
          amount,
          checkinToken: randomUUID(),
        },
      });
      return { waitlisted: false as const, registration };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result.waitlisted || !result.registration) {
    redirect(`/events/${event.slug}?registered=waitlist`);
  }
  const registration = result.registration;

  if (amount > 0) {
    if (!event.org.stripeConnectedAccountId) throw new Error("Stripe niet gekoppeld");
    const fee = Math.round(amount * (APP_FEE_PERCENT / 100));
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: event.org.defaultCurrency,
              product_data: { name: `${type === "deposit" ? "Waarborg" : "Ticket"}: ${event.title}` },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: fee,
          metadata: { registrationId: registration.id, eventId, userId: session.user.id },
        },
        customer_email: session.user.email ?? undefined,
        success_url: `${appUrl()}/events/${event.slug}?registered=success`,
        cancel_url: `${appUrl()}/events/${event.slug}?registered=cancelled`,
        metadata: { registrationId: registration.id, eventId, userId: session.user.id },
      },
      onAccount(event.org.stripeConnectedAccountId),
    );
    await db.registration.update({
      where: { id: registration.id },
      data: { stripeCheckoutSessionId: checkout.id },
    });
    if (checkout.url) redirect(checkout.url);
  }

  revalidatePath(`/events/${event.slug}`);
}

/** Member cancels their own registration: refunds any payment and promotes the waitlist. */
export async function cancelRegistration(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  const reg = await db.registration.findUnique({
    where: { eventId_userId: { eventId, userId: session.user.id } },
    include: { event: { include: { org: true } } },
  });
  if (!reg) return;
  if (reg.status === "cancelled" || reg.status === "refunded") {
    redirect(`/events/${reg.event.slug}`);
  }
  if (reg.event.startsAt.getTime() < Date.now()) {
    throw new Error("Het event is al begonnen — annuleren kan niet meer.");
  }

  const freedConfirmedSeat = reg.status === "confirmed" || reg.status === "pending";

  // Refund a paid deposit/ticket if we charged one.
  if (
    reg.amount &&
    reg.amount > 0 &&
    reg.stripePaymentIntentId &&
    reg.event.org.stripeConnectedAccountId &&
    reg.status !== "waitlisted"
  ) {
    try {
      await stripe.refunds.create(
        { payment_intent: reg.stripePaymentIntentId, refund_application_fee: true },
        onAccount(reg.event.org.stripeConnectedAccountId),
      );
    } catch (err) {
      console.error("[events] cancel refund failed:", err);
    }
  }

  await db.registration.update({ where: { id: reg.id }, data: { status: "cancelled" } });

  // A confirmed seat freed up → promote the first person on the waitlist.
  if (freedConfirmedSeat) {
    const next = await db.registration.findFirst({
      where: { eventId, status: "waitlisted" },
      orderBy: { waitlistPosition: "asc" },
    });
    if (next) {
      await db.registration.update({
        where: { id: next.id },
        data: { status: "confirmed", waitlistPosition: null },
      });
      await notify(next.userId, "event_promoted", {
        link: `/events/${reg.event.slug}`,
        title: reg.event.title,
      });
    }
  }

  redirect(`/events/${reg.event.slug}?registered=cancelled`);
}

/** Host/admin checks a registrant in; refunds the deposit on attendance. */
export async function checkInRegistration(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) return;

  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    include: { event: { include: { org: true } } },
  });
  if (!reg) return;
  if (session.user.role !== "ADMIN" && reg.event.hostId !== session.user.id) {
    throw new Error("Forbidden");
  }
  if (reg.checkedInAt) return;
  if (reg.status !== "confirmed") {
    throw new Error("Inschrijving is niet bevestigd");
  }

  await db.registration.update({ where: { id: registrationId }, data: { checkedInAt: new Date() } });

  // Refund the no-show deposit now that the member showed up (incl. the platform fee).
  if (reg.type === "deposit" && reg.stripePaymentIntentId && reg.event.org.stripeConnectedAccountId) {
    try {
      await stripe.refunds.create(
        { payment_intent: reg.stripePaymentIntentId, refund_application_fee: true },
        onAccount(reg.event.org.stripeConnectedAccountId),
      );
      await db.registration.update({
        where: { id: registrationId },
        data: { refundedAt: new Date(), status: "refunded" },
      });
    } catch (err) {
      console.error("[events] deposit refund failed:", err);
    }
  }

  revalidatePath(`/events/${reg.event.slug}/checkin`);
}
