"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { awardPointsOnce } from "@/lib/points";

/** Award a small daily-login bonus, at most once per calendar day. */
export async function claimDailyPoints() {
  const session = await auth();
  if (!session?.user) return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await awardPointsOnce(session.user.id, 2, "daily_login", "day", today);
  // Keep a queryable last-active signal for admin retention analytics.
  await db.user
    .update({ where: { id: session.user.id }, data: { lastActiveAt: new Date() } })
    .catch(() => null);
}
