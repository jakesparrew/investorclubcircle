import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { syncStripeEvent } from "@/lib/stripe-sync";

// Stripe signature verification needs the raw body + the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: skip events we've already processed.
  const seen = await db.webhookEvent.findUnique({ where: { stripeEventId: event.id } });
  if (seen) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await syncStripeEvent(event);
    await db.webhookEvent.create({ data: { stripeEventId: event.id, type: event.type } });
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    // Return 500 so Stripe retries; the event is NOT marked processed.
    return new Response("Webhook handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
