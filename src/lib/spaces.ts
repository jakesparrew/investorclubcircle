import { db } from "@/lib/db";
import { canAccess, type AccessContext, type AccessRequirement, type TierKey } from "@/lib/access";

/** Translate a Space's gating columns into an AccessRequirement. */
export function spaceRequirement(space: { isPublic: boolean; minTier: string | null }): AccessRequirement {
  if (space.isPublic) return { public: true };
  return { minTier: (space.minTier ?? "free") as TierKey };
}

export type SpaceWithAccess = Awaited<ReturnType<typeof db.space.findMany>>[number] & {
  accessible: boolean;
};

export async function listAccessibleSpaceGroups(orgId: string, ctx: AccessContext) {
  const groups = await db.spaceGroup.findMany({
    where: { orgId },
    orderBy: { sortOrder: "asc" },
    include: { spaces: { orderBy: { sortOrder: "asc" } } },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    spaces: g.spaces.map((s) => ({ ...s, accessible: canAccess(ctx, spaceRequirement(s)).ok })),
  }));
}
