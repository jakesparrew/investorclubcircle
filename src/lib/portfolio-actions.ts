"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** MOCK: pretend to connect an investeren.org account (no real API call yet). */
export async function linkPortfolio() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await db.portfolioLink.upsert({
    where: { userId: session.user.id },
    update: { status: "linked", lastSyncedAt: new Date() },
    create: {
      userId: session.user.id,
      provider: "investeren.org",
      externalAccountId: `mock-${session.user.id.slice(0, 8)}`,
      status: "linked",
      lastSyncedAt: new Date(),
    },
  });
  revalidatePath("/portfolio");
}

export async function unlinkPortfolio() {
  const session = await auth();
  if (!session?.user) return;
  await db.portfolioLink.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/portfolio");
}
