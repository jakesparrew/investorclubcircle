"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { completeOnboardingStep } from "@/lib/onboarding-progress";

export async function markOnboardingStep(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const stepKey = String(formData.get("stepKey") ?? "");
  if (!stepKey) return;

  await completeOnboardingStep(session.user.id, stepKey).catch(() => null);
  revalidatePath("/dashboard");
}
