import Stripe from "stripe";

// Fail loud in production if the secret is missing; allow a placeholder in
// dev/build so the app boots without real keys.
function stripeSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY is required in production");
  }
  return "sk_test_placeholder";
}

// Platform-account client. Connect direct-charge calls are scoped per-request
// with `{ stripeAccount }` (see helpers). apiVersion is the literal the
// installed stripe@22 types accept.
export const stripe = new Stripe(stripeSecret(), {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});

/** Commission percentage charged on connected-account transactions. */
export const APP_FEE_PERCENT = Number(process.env.PLATFORM_APP_FEE_PERCENT ?? "5");

/** Per-request option that routes a call to a connected (Standard) account. */
export function onAccount(stripeAccountId: string): Stripe.RequestOptions {
  return { stripeAccount: stripeAccountId };
}

// ─── Connect onboarding ─────────────────────────────────────────────────────

export function createConnectStandardAccount(email: string) {
  return stripe.accounts.create({
    type: "standard",
    email,
    metadata: { platform: "investorclub" },
  });
}

export function createAccountOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string) {
  return stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: refreshUrl,
    return_url: returnUrl,
  });
}

// ─── Checkout ───────────────────────────────────────────────────────────────

export function createSubscriptionCheckout(opts: {
  connectedAccountId: string;
  priceId: string;
  customerEmail?: string;
  trialDays?: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: opts.priceId, quantity: 1 }],
      customer_email: opts.customerEmail,
      allow_promotion_codes: true,
      subscription_data: {
        application_fee_percent: APP_FEE_PERCENT,
        ...(opts.trialDays ? { trial_period_days: opts.trialDays } : {}),
        metadata: opts.metadata,
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: opts.metadata,
    },
    onAccount(opts.connectedAccountId),
  );
}

export function createOneTimeCheckout(opts: {
  connectedAccountId: string;
  priceId: string;
  amount: number; // minor units, for fee computation
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const fee = Math.round(opts.amount * (APP_FEE_PERCENT / 100));
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [{ price: opts.priceId, quantity: 1 }],
      customer_email: opts.customerEmail,
      payment_intent_data: {
        application_fee_amount: fee,
        metadata: opts.metadata,
      },
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: opts.metadata,
    },
    onAccount(opts.connectedAccountId),
  );
}

// ─── Promotions ─────────────────────────────────────────────────────────────

export function createCoupon(connectedAccountId: string, params: Stripe.CouponCreateParams) {
  return stripe.coupons.create(params, onAccount(connectedAccountId));
}

export function createPromotionCode(connectedAccountId: string, params: Stripe.PromotionCodeCreateParams) {
  return stripe.promotionCodes.create(params, onAccount(connectedAccountId));
}
