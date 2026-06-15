import { db } from "@/lib/db";
import { auth } from "@/auth";
import { VISITOR, type AccessContext, type Role, type TierKey } from "@/lib/access";

/**
 * Resolve the live entitlement snapshot for a user from the database.
 * Pass this into `canAccess()`. Returns VISITOR for unauthenticated users.
 */
export async function getAccessContext(
  userId: string | null | undefined,
  role: Role | null | undefined,
): Promise<AccessContext> {
  if (!userId || !role) return VISITOR;

  const [membership, paidOrders, userTags] = await Promise.all([
    db.membership.findFirst({
      where: { userId, status: { in: ["active", "trialing"] } },
      include: { tier: true },
    }),
    db.order.findMany({
      where: { userId, status: "paid", productId: { not: null } },
      select: { productId: true },
    }),
    db.userTag.findMany({ where: { userId }, include: { tag: true } }),
  ]);

  return {
    role,
    tier: (membership?.tier.key ?? "free") as TierKey,
    ownedProductIds: paidOrders.map((o) => o.productId).filter((id): id is string => id !== null),
    tags: userTags.map((ut) => ut.tag.name),
  };
}

/** Convenience: resolve the access context for the current session. */
export async function getCurrentAccessContext(): Promise<AccessContext> {
  const session = await auth();
  return getAccessContext(session?.user?.id, session?.user?.role);
}
