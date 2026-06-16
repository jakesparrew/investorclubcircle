"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getOrCreateAffiliateCode() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const existing = await db.affiliate.findUnique({ where: { userId: session.user.id } });
  if (existing) return;

  const code = `IC${randomUUID().slice(0, 6).toUpperCase()}`;
  await db.affiliate.create({
    data: { userId: session.user.id, code, commissionPercent: 0, status: "active" },
  });
  revalidatePath("/referral");
}
