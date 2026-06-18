"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { PromotionKind, DurationType } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createCoupon, createPromotionCode } from "@/lib/stripe";

function asKind(v: string): PromotionKind {
  return (["PERCENT", "AMOUNT", "TRIAL", "INTRO"].includes(v) ? v : "PERCENT") as PromotionKind;
}
function asDuration(v: string): DurationType {
  return (["ONCE", "REPEATING", "FOREVER"].includes(v) ? v : "ONCE") as DurationType;
}

export async function createPromotionAction(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  const org = await db.organization.findFirst();
  if (!org) throw new Error("Geen organisatie");

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return;
  const kind = asKind(String(formData.get("kind") ?? "PERCENT"));
  const durationType = asDuration(String(formData.get("durationType") ?? "ONCE"));
  const value = parseInt(String(formData.get("value") ?? ""), 10) || null;
  const durationMonths = parseInt(String(formData.get("durationMonths") ?? ""), 10) || null;

  // Best-effort sync to Stripe (works once Connect onboarding is complete).
  let stripeCouponId: string | null = null;
  let stripePromotionCodeId: string | null = null;
  if (org.stripeConnectedAccountId) {
    try {
      const params: Stripe.CouponCreateParams = {
        duration: durationType.toLowerCase() as Stripe.CouponCreateParams.Duration,
      };
      if (durationType === "REPEATING" && durationMonths) params.duration_in_months = durationMonths;
      if (kind === "PERCENT" && value) params.percent_off = value;
      if (kind === "AMOUNT" && value) {
        params.amount_off = value;
        params.currency = org.defaultCurrency;
      }
      const coupon = await createCoupon(org.stripeConnectedAccountId, params);
      stripeCouponId = coupon.id;
      // NOTE: promotion-code params shape varies by Stripe API version; this is
      // exercised only once Connect is live, and is guarded by the try/catch.
      const pc = await createPromotionCode(org.stripeConnectedAccountId, {
        coupon: coupon.id,
        code,
      } as unknown as Stripe.PromotionCodeCreateParams);
      stripePromotionCodeId = pc.id;
    } catch (err) {
      console.error("[coupons] Stripe sync failed (saved locally):", err);
    }
  }

  await db.promotion.upsert({
    where: { orgId_code: { orgId: org.id, code } },
    update: {
      kind,
      value,
      durationType,
      durationMonths,
      active: true,
      ...(stripeCouponId ? { stripeCouponId } : {}),
      ...(stripePromotionCodeId ? { stripePromotionCodeId } : {}),
    },
    create: { orgId: org.id, code, kind, value, durationType, durationMonths, stripeCouponId, stripePromotionCodeId },
  });
  revalidatePath("/admin/coupons");
}

export async function togglePromotion(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const active = String(formData.get("active") ?? "") === "true";
  await db.promotion.update({ where: { id }, data: { active } });
  revalidatePath("/admin/coupons");
}
