"use server";

import { auth } from "@/auth";
import { awardPointsOnce } from "@/lib/points";

/** Award a small daily-login bonus, at most once per calendar day. */
export async function claimDailyPoints() {
  const session = await auth();
  if (!session?.user) return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await awardPointsOnce(session.user.id, 2, "daily_login", "day", today);
}
