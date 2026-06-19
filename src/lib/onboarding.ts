"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { awardPointsOnce } from "@/lib/points";

/** Award the "Goed begonnen" badge + bonus once the whole checklist is done. */
async function maybeAwardOnboardingBadge(userId: string) {
  const org = await db.organization.findFirst();
  if (!org) return;
  const [total, done] = await Promise.all([
    db.onboardingStep.count({ where: { orgId: org.id } }),
    db.userOnboardingProgress.count({ where: { userId } }),
  ]);
  if (total === 0 || done < total) return;

  const badge = await db.badge.upsert({
    where: { key: "onboarded" },
    update: {},
    create: { key: "onboarded", name: "Goed begonnen", icon: "🚀" },
  });
  const existing = await db.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) return;
  await db.userBadge.create({ data: { userId, badgeId: badge.id } });
  await awardPointsOnce(userId, 25, "onboarding_complete", "onboarding", userId);
}

export async function markOnboardingStep(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const stepKey = String(formData.get("stepKey") ?? "");
  if (!stepKey) return;

  await db.userOnboardingProgress.upsert({
    where: { userId_stepKey: { userId: session.user.id, stepKey } },
    update: {},
    create: { userId: session.user.id, stepKey },
  });
  await maybeAwardOnboardingBadge(session.user.id).catch(() => null);
  revalidatePath("/dashboard");
}
