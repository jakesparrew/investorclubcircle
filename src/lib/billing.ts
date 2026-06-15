"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createSubscriptionCheckout, createOneTimeCheckout } from "@/lib/stripe";
import { optionalEnv } from "@/lib/env";

async function requireConnectedOrg() {
  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization configured. Run the seed.");
  if (!org.stripeConnectedAccountId) {
    throw new Error("Organization is not yet connected to Stripe (complete Connect onboarding).");
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
  if (!tier) throw new Error("Tier not found");

  const priceId = interval === "year" ? tier.stripePriceYearlyId : tier.stripePriceMonthlyId;
  if (!priceId) throw new Error(`Tier "${tier.key}" has no Stripe price for interval "${interval}"`);

  const checkout = await createSubscriptionCheckout({
    connectedAccountId: org.stripeConnectedAccountId,
    priceId,
    customerEmail: session.user.email ?? undefined,
    successUrl: `${appUrl()}/dashboard?checkout=success`,
    cancelUrl: `${appUrl()}/pricing?checkout=cancelled`,
    metadata: { userId: session.user.id, orgId: org.id, tierId },
  });

  if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
  redirect(checkout.url);
}

/** Start a one-time checkout for a product price. Redirects to Stripe Checkout. */
export async function startProductCheckout(productId: string, priceId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await requireConnectedOrg();
  const price = await db.price.findUnique({ where: { id: priceId } });
  if (!price || !price.stripePriceId) throw new Error("Price not found or not synced to Stripe");

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
