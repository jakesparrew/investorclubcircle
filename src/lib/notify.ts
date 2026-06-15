import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/** Create an in-app notification. Internal helper (not a server action). */
export async function notify(
  userId: string,
  type: string,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  await db.notification.create({ data: { userId, type, payload } });
}
