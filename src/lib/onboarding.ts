"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  revalidatePath("/dashboard");
}
