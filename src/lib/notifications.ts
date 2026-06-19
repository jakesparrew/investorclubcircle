"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) return;
  await db.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markNotificationRead(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Scope the update to the requester so one user can't read another's items.
  await db.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
