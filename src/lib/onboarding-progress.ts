import { db } from "@/lib/db";
import { awardPointsOnce } from "@/lib/points";

/** Award the "Goed begonnen" badge + bonus once the whole checklist is done. */
export async function maybeAwardOnboardingBadge(userId: string) {
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

/**
 * Mark an onboarding step complete (idempotent) and award the badge if that was
 * the last step. Safe to call from any action — wrap in `.catch()` so a failure
 * never breaks the primary flow.
 */
export async function completeOnboardingStep(userId: string, stepKey: string) {
  await db.userOnboardingProgress.upsert({
    where: { userId_stepKey: { userId, stepKey } },
    update: {},
    create: { userId, stepKey },
  });
  await maybeAwardOnboardingBadge(userId);
}
