"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

/** Internal: is there a block in either direction between two users? */
async function blockedBetween(a: string, b: string): Promise<boolean> {
  return Boolean(
    await db.blockedUser.findFirst({
      where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    }),
  );
}

/** Block a user — prevents new DMs and messages in either direction. */
export async function blockUser(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === session.user.id) return;
  await db.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: userId } },
    update: {},
    create: { blockerId: session.user.id, blockedId: userId },
  });
  revalidatePath(`/members/${userId}`);
}

export async function unblockUser(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await db.blockedUser
    .delete({ where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: userId } } })
    .catch(() => null);
  revalidatePath(`/members/${userId}`);
}

/** Edit one of your own messages. */
export async function editMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const messageId = String(formData.get("messageId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!messageId || !content) return;
  const msg = await db.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.senderId !== session.user.id || msg.deletedAt) return;
  await db.message.update({ where: { id: messageId }, data: { content, editedAt: new Date() } });
  revalidatePath(`/messages/${msg.conversationId}`);
}

/** Soft-delete one of your own messages. */
export async function deleteMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return;
  const msg = await db.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.senderId !== session.user.id) return;
  await db.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  revalidatePath(`/messages/${msg.conversationId}`);
}

/** Start (or reuse) a 1-on-1 conversation with a user identified by email. */
export async function startDirectByEmail(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return;

  const other = await db.user.findUnique({ where: { email } });
  if (!other) throw new Error("Geen gebruiker met dat e-mailadres");
  if (other.id === session.user.id) throw new Error("Je kunt jezelf geen bericht sturen");
  if (await blockedBetween(session.user.id, other.id))
    throw new Error("Berichten met dit lid zijn geblokkeerd.");

  const mine = await db.conversation.findMany({
    where: { type: "direct", members: { some: { userId: session.user.id } } },
    include: { members: true },
  });
  const existing = mine.find(
    (c) => c.members.length === 2 && c.members.some((m) => m.userId === other.id),
  );

  const conversationId =
    existing?.id ??
    (
      await db.conversation.create({
        data: {
          type: "direct",
          createdById: session.user.id,
          members: { create: [{ userId: session.user.id }, { userId: other.id }] },
        },
      })
    ).id;

  redirect(`/messages/${conversationId}`);
}

/** Start (or reuse) a 1-on-1 conversation with a user by id (from the directory). */
export async function startDirectByUserId(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const otherId = String(formData.get("userId") ?? "");
  if (!otherId || otherId === session.user.id) return;

  const other = await db.user.findUnique({ where: { id: otherId } });
  if (!other) return;
  if (await blockedBetween(session.user.id, otherId))
    throw new Error("Berichten met dit lid zijn geblokkeerd.");

  const mine = await db.conversation.findMany({
    where: { type: "direct", members: { some: { userId: session.user.id } } },
    include: { members: true },
  });
  const existing = mine.find(
    (c) => c.members.length === 2 && c.members.some((m) => m.userId === otherId),
  );

  const conversationId =
    existing?.id ??
    (
      await db.conversation.create({
        data: {
          type: "direct",
          createdById: session.user.id,
          members: { create: [{ userId: session.user.id }, { userId: otherId }] },
        },
      })
    ).id;

  redirect(`/messages/${conversationId}`);
}

export async function sendMessage(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!conversationId || !content) return;

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!membership) throw new Error("Geen toegang tot dit gesprek");

  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { select: { userId: true } } },
  });
  if (convo?.type === "direct") {
    const other = convo.members.find((m) => m.userId !== session.user.id);
    if (other && (await blockedBetween(session.user.id, other.userId))) {
      throw new Error("Berichten met dit lid zijn geblokkeerd.");
    }
  }

  await db.message.create({ data: { conversationId, senderId: session.user.id, content } });
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  // Notify the other participants so chat isn't a silent channel.
  const others = await db.conversationMember.findMany({
    where: { conversationId, userId: { not: session.user.id } },
    select: { userId: true },
  });
  const by = session.user.name ?? session.user.email ?? "Iemand";
  await Promise.all(
    others.map((o) => notify(o.userId, "message", { by, link: `/messages/${conversationId}` })),
  );

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
}

/** Create a group conversation; the creator becomes its admin. */
export async function createGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const convo = await db.conversation.create({
    data: {
      type: "group",
      title,
      createdById: session.user.id,
      members: { create: [{ userId: session.user.id, role: "admin" }] },
    },
  });
  redirect(`/messages/${convo.id}`);
}

/** Add a member (by email) to a group the requester belongs to. */
export async function addGroupMember(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const conversationId = String(formData.get("conversationId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!conversationId || !email) return;

  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  });
  if (!membership) throw new Error("Geen toegang tot dit gesprek");
  const convo = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || convo.type !== "group") return;

  const other = await db.user.findUnique({ where: { email } });
  if (!other) throw new Error("Geen gebruiker met dat e-mailadres");

  await db.conversationMember.upsert({
    where: { conversationId_userId: { conversationId, userId: other.id } },
    update: {},
    create: { conversationId, userId: other.id },
  });
  revalidatePath(`/messages/${conversationId}`);
}
