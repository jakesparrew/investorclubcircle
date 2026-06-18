"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  createSubscriptionCheckout,
  createOneTimeCheckout,
  createBillingPortalSession,
  setSubscriptionCancelAtPeriodEnd,
  pauseSubscription as stripePause,
  resumeSubscription as stripeResume,
  applyCouponToSubscription,
} from "@/lib/stripe";
import { optionalEnv } from "@/lib/env";

async function requireConnectedOrg() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization configured. Run the seed.");
  if (!org.stripeConnectedAccountId) {
    throw new Error("Organization is not yet connected to Stripe (complete Connect onboarding).");
  }
  if (org.stripeAccountStatus && org.stripeAccountStatus !== "active") {
    throw new Error("Stripe-account is nog niet volledig actief.");
  }
  return org as typeof org & { stripeConnectedAccountId: string };
}

function appUrl() {
  return optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
}

/** Start a subscription checkout for a tier. Redirects to Stripe Checkout. */
export async function startSubscriptionCheckout(tierId: string, interval: "month" | "year") {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await requireConnectedOrg();
  const tier = await db.tier.findUnique({ where: { id: tierId } });
  if (!tier || !tier.active) throw new Error("Tier niet beschikbaar");

  const priceId = interval === "year" ? tier.stripePriceYearlyId : tier.stripePriceMonthlyId;
  if (!priceId) throw new Error(`Tier "${tier.key}" has no Stripe price for interval "${interval}"`);

  const checkout = await createSubscriptionCheckout({
    connectedAccountId: org.stripeConnectedAccountId,
    priceId,
    customerEmail: session.user.email ?? undefined,
    trialDays: tier.trialDays ?? undefined,
    successUrl: `${appUrl()}/dashboard?checkout=success`,
    cancelUrl: `${appUrl()}/pricing?checkout=cancelled`,
    metadata: { userId: session.user.id, orgId: org.id, tierId },
  });

  if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
  redirect(checkout.url);
}

/** Find the requester's most relevant membership (active/trialing/past_due). */
async function currentMembership(userId: string) {
  return db.membership.findFirst({
    where: { userId, status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { startedAt: "desc" },
  });
}

/** Open the Stripe customer billing portal (manage card / cancel / switch plan). */
export async function openBillingPortal() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await requireConnectedOrg();
  const membership = await currentMembership(session.user.id);
  if (!membership?.stripeCustomerId) redirect("/pricing");

  const portal = await createBillingPortalSession(
    org.stripeConnectedAccountId,
    membership.stripeCustomerId,
    `${appUrl()}/dashboard`,
  );
  if (!portal.url) throw new Error("Stripe did not return a portal URL");
  redirect(portal.url);
}

export async function cancelSubscription() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await requireConnectedOrg();
  const membership = await currentMembership(session.user.id);
  if (!membership?.stripeSubscriptionId) redirect("/dashboard");
  await setSubscriptionCancelAtPeriodEnd(org.stripeConnectedAccountId, membership.stripeSubscriptionId, true);
  await db.membership.update({ where: { id: membership.id }, data: { cancelAtPeriodEnd: true } });
  revalidatePath("/dashboard");
  redirect("/dashboard?subscription=cancelling");
}

export async function resumeSubscription() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await requireConnectedOrg();
  const membership = await currentMembership(session.user.id);
  if (!membership?.stripeSubscriptionId) redirect("/dashboard");
  await stripeResume(org.stripeConnectedAccountId, membership.stripeSubscriptionId);
  await db.membership.update({ where: { id: membership.id }, data: { cancelAtPeriodEnd: false } });
  revalidatePath("/dashboard");
  redirect("/dashboard?subscription=resumed");
}

/** Win-back: pause collection for one cycle instead of cancelling. */
export async function pauseSubscription() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await requireConnectedOrg();
  const membership = await currentMembership(session.user.id);
  if (!membership?.stripeSubscriptionId) redirect("/dashboard");
  await stripePause(org.stripeConnectedAccountId, membership.stripeSubscriptionId);
  revalidatePath("/dashboard");
  redirect("/dashboard?subscription=paused");
}

/** Win-back: keep the subscription but apply a retention coupon. */
export async function applyWinbackDiscount() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await requireConnectedOrg();
  const membership = await currentMembership(session.user.id);
  if (!membership?.stripeSubscriptionId) redirect("/dashboard");

  const promo = await db.promotion.findFirst({
    where: { orgId: org.id, active: true, kind: "PERCENT", stripeCouponId: { not: null } },
    orderBy: { value: "desc" },
  });
  if (!promo?.stripeCouponId) redirect("/dashboard/cancel?winback=unavailable");
  await applyCouponToSubscription(org.stripeConnectedAccountId, membership.stripeSubscriptionId, promo.stripeCouponId);
  revalidatePath("/dashboard");
  redirect("/dashboard?subscription=discount_applied");
}

/** À-la-carte: buy a single course (one-time) via its linked Product. */
export async function buyCourse(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const org = await requireConnectedOrg();
  const product = await db.product.findFirst({
    where: { orgId: org.id, courseId, active: true },
    include: { prices: { where: { active: true }, take: 1 } },
  });
  const price = product?.prices[0];
  if (!product || !price?.stripePriceId) throw new Error("Deze cursus is niet los te koop.");

  const order = await db.order.create({
    data: {
      userId: session.user.id,
      productId: product.id,
      priceId: price.id,
      amount: price.amount,
      currency: price.currency,
      status: "pending",
    },
  });
  const checkout = await createOneTimeCheckout({
    connectedAccountId: org.stripeConnectedAccountId,
    priceId: price.stripePriceId,
    amount: price.amount,
    customerEmail: session.user.email ?? undefined,
    successUrl: `${appUrl()}/academy?purchase=success`,
    cancelUrl: `${appUrl()}/academy`,
    metadata: { userId: session.user.id, orgId: org.id, orderId: order.id },
  });
  if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: checkout.id } });
  redirect(checkout.url);
}

/** Start a one-time checkout for a product price. Redirects to Stripe Checkout. */
export async function startProductCheckout(productId: string, priceId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await requireConnectedOrg();
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) throw new Error("Product niet beschikbaar");

  const price = await db.price.findUnique({ where: { id: priceId } });
  // Validate the price actually belongs to this product (prevents price manipulation).
  if (!price || price.productId !== productId || !price.active || !price.stripePriceId) {
    throw new Error("Ongeldige prijs voor dit product");
  }

  const order = await db.order.create({
    data: {
      userId: session.user.id,
      productId,
      priceId,
      amount: price.amount,
      currency: price.currency,
      status: "pending",
    },
  });

  const checkout = await createOneTimeCheckout({
    connectedAccountId: org.stripeConnectedAccountId,
    priceId: price.stripePriceId,
    amount: price.amount,
    customerEmail: session.user.email ?? undefined,
    successUrl: `${appUrl()}/dashboard?order=success`,
    cancelUrl: `${appUrl()}/shop?order=cancelled`,
    metadata: { userId: session.user.id, orgId: org.id, orderId: order.id },
  });

  if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
  await db.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: checkout.id } });
  redirect(checkout.url);
}
