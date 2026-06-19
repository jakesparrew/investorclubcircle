import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { getUserTotalPoints, getLoginStreak, getLeaderboard, type LeaderboardRow } from "@/lib/points";
import { listAccessibleSpaceGroups } from "@/lib/spaces";

const DAY = 86_400_000;

export type DashboardData = {
  orgId: string | null;
  points: number;
  streak: number;
  tierKey: string;
  tierName: string;
  membershipStatus: string;
  renewal: {
    periodEnd: Date | null;
    interval: string | null;
    cancelAtPeriodEnd: boolean;
    amountCents: number | null;
    isTrial: boolean;
  } | null;
  badges: { name: string; icon: string }[];
  coursePct: number;
  pointsSeries: number[];
  pointsWeekDeltaPct: number;
  pointsThisWeek: number;
  level: { name: string; toNext: number; nextName: string | null; pct: number };
  courses: { id: string; title: string; slug: string; pct: number; total: number; done: number }[];
  events: { id: string; title: string; slug: string; startsAt: Date; location: string | null }[];
  leaderboard: LeaderboardRow[];
  myRank: number | null;
  activity: {
    id: string;
    title: string | null;
    content: string;
    createdAt: Date;
    spaceName: string;
    spaceSlug: string;
    authorName: string;
    authorImage: string | null;
  }[];
};

export async function getDashboardData(userId: string, role: Role): Promise<DashboardData> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);

  const org = await db.organization.findFirst();
  const ctx = await getAccessContext(userId, role);

  const [points, streak, membership, ledger, enrollments, progressRows, events, leaderboard, levels, badgeRows] =
    await Promise.all([
      getUserTotalPoints(userId),
      getLoginStreak(userId),
      db.membership.findFirst({
        where: { userId, status: { in: ["active", "trialing"] } },
        include: { tier: true },
        orderBy: { startedAt: "desc" },
      }),
      db.pointsLedger.findMany({
        where: { userId, createdAt: { gte: since30 } },
        select: { points: true, createdAt: true },
      }),
      db.enrollment.findMany({
        where: { userId },
        include: { course: { include: { modules: { include: { lessons: { select: { id: true } } } } } } },
      }),
      db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } }),
      db.event.findMany({
        where: { status: "published", startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 4,
      }),
      getLeaderboard(50),
      org
        ? db.level.findMany({ where: { orgId: org.id }, orderBy: { minPoints: "asc" } })
        : Promise.resolve([]),
      db.userBadge.findMany({
        where: { userId },
        include: { badge: { select: { name: true, icon: true } } },
        orderBy: { awardedAt: "desc" },
        take: 12,
      }),
    ]);

  // 30-day cumulative points series.
  const dayStart = new Date(now.getTime() - 29 * DAY);
  dayStart.setHours(0, 0, 0, 0);
  const buckets = new Array(30).fill(0);
  let thisWeek = 0;
  let prevWeek = 0;
  for (const row of ledger) {
    const idx = Math.floor((row.createdAt.getTime() - dayStart.getTime()) / DAY);
    if (idx >= 0 && idx < 30) buckets[idx] += row.points;
    const age = now.getTime() - row.createdAt.getTime();
    if (age <= 7 * DAY) thisWeek += row.points;
    else if (age <= 14 * DAY) prevWeek += row.points;
  }
  let run = 0;
  const pointsSeries = buckets.map((b) => (run += b));
  const pointsWeekDeltaPct = prevWeek
    ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100)
    : thisWeek > 0
      ? 100
      : 0;

  // Course progress.
  const done = new Set(progressRows.map((p) => p.lessonId));
  const courses = enrollments.map((e) => {
    const lessons = e.course.modules.flatMap((m) => m.lessons);
    const total = lessons.length;
    const d = lessons.filter((l) => done.has(l.id)).length;
    return {
      id: e.course.id,
      title: e.course.title,
      slug: e.course.slug,
      total,
      done: d,
      pct: total ? Math.round((d / total) * 100) : 0,
    };
  });
  const coursePct = courses.length
    ? Math.round(courses.reduce((s, c) => s + c.pct, 0) / courses.length)
    : 0;

  // Level + progress to next.
  let current: { name: string; minPoints: number } | null = null;
  let next: { name: string; minPoints: number } | null = null;
  for (const l of levels) {
    if (points >= l.minPoints) current = l;
    else if (!next) next = l;
  }
  const base = current?.minPoints ?? 0;
  const target = next?.minPoints ?? base;
  const level = {
    name: current?.name ?? "—",
    nextName: next?.name ?? null,
    toNext: next ? Math.max(0, next.minPoints - points) : 0,
    pct: next && target > base ? Math.round(((points - base) / (target - base)) * 100) : 100,
  };

  // My rank within the (top-50) leaderboard.
  const idx = leaderboard.findIndex((r) => r.userId === userId);
  const myRank = idx >= 0 ? idx + 1 : null;

  // Recent community activity from accessible spaces.
  let activity: DashboardData["activity"] = [];
  if (org) {
    const groups = await listAccessibleSpaceGroups(org.id, ctx);
    const spaceIds = groups.flatMap((g) => g.spaces.filter((s) => s.accessible).map((s) => s.id));
    if (spaceIds.length) {
      const posts = await db.post.findMany({
        where: { spaceId: { in: spaceIds }, hiddenAt: null },
        include: {
          author: { select: { name: true, email: true, image: true } },
          space: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
      activity = posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        spaceName: p.space.name,
        spaceSlug: p.space.slug,
        authorName: p.author.name ?? p.author.email,
        authorImage: p.author.image,
      }));
    }
  }

  const renewal = membership
    ? {
        periodEnd: membership.currentPeriodEnd,
        interval: membership.interval,
        cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
        amountCents:
          membership.interval === "year" ? membership.tier.priceYearly : membership.tier.priceMonthly,
        isTrial: membership.status === "trialing",
      }
    : null;
  const badges = badgeRows.map((b) => ({ name: b.badge.name, icon: b.badge.icon ?? "🏅" }));

  return {
    orgId: org?.id ?? null,
    points,
    streak,
    tierKey: membership?.tier.key ?? "free",
    tierName: membership?.tier.name ?? "Gratis",
    membershipStatus: membership?.status ?? "geen abonnement",
    renewal,
    badges,
    coursePct,
    pointsSeries,
    pointsWeekDeltaPct,
    pointsThisWeek: thisWeek,
    level,
    courses,
    events,
    leaderboard,
    myRank,
    activity,
  };
}
