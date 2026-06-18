"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveSegmentUserIds } from "@/lib/segments-query";

export async function sendSegmentMessage(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");

  const tier = String(formData.get("tier") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  const activity = String(formData.get("activity") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  if (!title) return;

  const userIds = await resolveSegmentUserIds({ tier, tagId, activity });
  if (userIds.length === 0) return;

  const payload = { title, body, ...(link ? { link } : {}) };
  await db.notification.createMany({
    data: userIds.map((userId) => ({ userId, type: "announcement", payload })),
  });
  revalidatePath("/admin/segments");
}
