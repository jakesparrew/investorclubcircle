import { db } from "@/lib/db";

const DAY = 86_400_000;

export type RevenueMetrics = {
  mrrCents: number;
  arrCents: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  churningCount: number;
  churnRate: number;
  arpuCents: number;
  ltvCents: number;
  byTier: { name: string; count: number; mrrCents: number }[];
  signupsWeekly: number[];
  totalMembers: number;
  enrollments: number;
  certificates: number;
  completionRate: number;
};

/** Operator KPIs computed from the live DB (no Stripe calls needed). */
export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const [memberships, pastDueCount, totalMembers, enrollments, certificates, recentUsers] =
    await Promise.all([
      db.membership.findMany({
        where: { status: { in: ["active", "trialing"] } },
        include: { tier: true },
      }),
      db.membership.count({ where: { status: "past_due" } }),
      db.user.count(),
      db.enrollment.count(),
      db.certificate.count(),
      db.user.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 8 * 7 * DAY) } },
        select: { createdAt: true },
      }),
    ]);

  let mrrCents = 0;
  const byTierMap = new Map<string, { count: number; mrrCents: number }>();
  let trialingCount = 0;
  let churningCount = 0;
  for (const m of memberships) {
    const monthly =
      m.interval === "year" ? Math.round((m.tier.priceYearly ?? 0) / 12) : m.tier.priceMonthly ?? 0;
    mrrCents += monthly;
    if (m.status === "trialing") trialingCount++;
    if (m.cancelAtPeriodEnd) churningCount++;
    const t = byTierMap.get(m.tier.name) ?? { count: 0, mrrCents: 0 };
    t.count++;
    t.mrrCents += monthly;
    byTierMap.set(m.tier.name, t);
  }

  const activeCount = memberships.length;
  const arpuCents = activeCount ? Math.round(mrrCents / activeCount) : 0;
  const churnRate = activeCount ? churningCount / activeCount : 0;
  const ltvCents = churnRate > 0 ? Math.round(arpuCents / churnRate) : arpuCents * 24;

  const WEEKS = 8;
  const signupsWeekly = new Array(WEEKS).fill(0);
  for (const u of recentUsers) {
    const weeksAgo = Math.floor((Date.now() - u.createdAt.getTime()) / (7 * DAY));
    const idx = WEEKS - 1 - weeksAgo;
    if (idx >= 0 && idx < WEEKS) signupsWeekly[idx]++;
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeCount,
    trialingCount,
    pastDueCount,
    churningCount,
    churnRate,
    arpuCents,
    ltvCents,
    byTier: [...byTierMap.entries()].map(([name, v]) => ({ name, ...v })),
    signupsWeekly,
    totalMembers,
    enrollments,
    certificates,
    completionRate: enrollments ? certificates / enrollments : 0,
  };
}
