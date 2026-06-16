"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  await db.message.create({ data: { conversationId, senderId: session.user.id, content } });
  await db.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });
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
