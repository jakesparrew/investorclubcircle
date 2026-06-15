import { db } from "@/lib/db";

/** Point values per action (gamification — Fase 2). */
export const POINTS = {
  post: 10,
  comment: 5,
  reaction_given: 1,
  reaction_received: 2,
  poll_vote: 1,
} as const;

export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  if (!points) return;
  await db.pointsLedger.create({ data: { userId, points, reason, sourceType, sourceId } });
}

export async function getUserTotalPoints(userId: string): Promise<number> {
  const agg = await db.pointsLedger.aggregate({ where: { userId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

export async function getLevelForPoints(orgId: string, points: number) {
  const levels = await db.level.findMany({ where: { orgId }, orderBy: { minPoints: "asc" } });
  let current: (typeof levels)[number] | null = null;
  for (const level of levels) {
    if (points >= level.minPoints) current = level;
  }
  return current;
}

export type LeaderboardRow = {
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  points: number;
};

export async function getLeaderboard(limit = 20): Promise<LeaderboardRow[]> {
  const rows = await db.pointsLedger.groupBy({
    by: ["userId"],
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, email: true, image: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = byId.get(r.userId);
    return {
      userId: r.userId,
      name: u?.name ?? null,
      email: u?.email ?? "",
      image: u?.image ?? null,
      points: r._sum.points ?? 0,
    };
  });
}
