import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SegmentFilter = { tier?: string; tagId?: string; activity?: string };

const TIERS = ["free", "basis", "premium"];
const DAY = 86_400_000;

export function buildSegmentWhere(filter: SegmentFilter): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (filter.tier && TIERS.includes(filter.tier)) {
    if (filter.tier === "free") {
      and.push({ memberships: { none: { status: { in: ["active", "trialing"] } } } });
    } else {
      and.push({
        memberships: { some: { status: { in: ["active", "trialing"] }, tier: { key: filter.tier } } },
      });
    }
  }
  if (filter.tagId) and.push({ tags: { some: { tagId: filter.tagId } } });

  const cutoff = new Date(Date.now() - 14 * DAY);
  if (filter.activity === "active") and.push({ points: { some: { createdAt: { gte: cutoff } } } });
  else if (filter.activity === "inactive") and.push({ points: { none: { createdAt: { gte: cutoff } } } });

  return and.length ? { AND: and } : {};
}

export async function resolveSegment(filter: SegmentFilter) {
  const where = buildSegmentWhere(filter);
  const [count, sample] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: { id: true, name: true, email: true, image: true },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  ]);
  return { count, sample };
}

export async function resolveSegmentUserIds(filter: SegmentFilter): Promise<string[]> {
  const rows = await db.user.findMany({ where: buildSegmentWhere(filter), select: { id: true }, take: 5000 });
  return rows.map((r) => r.id);
}
