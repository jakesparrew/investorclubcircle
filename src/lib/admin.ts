"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/access";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

export async function setUserRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!userId || !["MEMBER", "EXPERT", "ADMIN"].includes(role)) return;

  await db.user.update({ where: { id: userId }, data: { role } });
  // Invalidate existing sessions so the new role takes effect immediately.
  await db.session.deleteMany({ where: { userId } });
  await db.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "set_user_role",
      targetType: "User",
      targetId: userId,
      metadata: { role },
    },
  });
  revalidatePath("/admin/members");
}

export async function toggleTierActiveAction(formData: FormData) {
  const session = await requireAdmin();
  const tierId = String(formData.get("tierId") ?? "");
  if (!tierId) return;

  const tier = await db.tier.findUnique({ where: { id: tierId } });
  if (!tier) return;

  await db.tier.update({ where: { id: tierId }, data: { active: !tier.active } });
  await db.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "toggle_tier_active",
      targetType: "Tier",
      targetId: tierId,
      metadata: { active: !tier.active },
    },
  });
  revalidatePath("/admin/tiers");
}
