import { db } from "@/lib/db";

export type UnreadCounts = { messages: number; notifications: number };

/**
 * Cheap unread badges for the top bar: count of conversations with a newer
 * message from someone else, and unread notifications. Fails soft to zeroes
 * when the DB is not reachable.
 */
export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  try {
    const [notifications, memberships] = await Promise.all([
      db.notification.count({ where: { userId, readAt: null } }),
      db.conversationMember.findMany({
        where: { userId },
        select: {
          lastReadAt: true,
          conversation: {
            select: {
              messages: {
                where: { deletedAt: null },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true, senderId: true },
              },
            },
          },
        },
      }),
    ]);
    let messages = 0;
    for (const m of memberships) {
      const last = m.conversation.messages[0];
      if (!last || last.senderId === userId) continue;
      if (!m.lastReadAt || last.createdAt > m.lastReadAt) messages++;
    }
    return { messages, notifications };
  } catch {
    return { messages: 0, notifications: 0 };
  }
}
