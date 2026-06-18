import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendMessage, addGroupMember } from "@/lib/chat";
import { ChatAutoRefresh } from "@/components/ChatAutoRefresh";
import { ChatScroll } from "@/components/chat/ChatScroll";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ConversationDetail = Prisma.ConversationGetPayload<{
  include: {
    members: { include: { user: { select: { id: true; name: true; email: true; image: true } } } };
    messages: { include: { sender: { select: { id: true; name: true; email: true; image: true } } } };
  };
}>;

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/messages/${id}`);

  const membership = await db.conversationMember
    .findUnique({ where: { conversationId_userId: { conversationId: id, userId: session.user.id } } })
    .catch(() => null);
  if (!membership) redirect("/messages");

  let conversation: ConversationDetail | null = null;
  try {
    conversation = await db.conversation.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        messages: {
          where: { deletedAt: null },
          include: { sender: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        },
      },
    });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
  }
  if (!conversation) redirect("/messages");

  // Mark this thread as read for the current viewer.
  await db.conversationMember
    .update({
      where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    })
    .catch(() => null);

  const me = session.user.id;
  const other = conversation.members.find((m) => m.user.id !== me);
  const title = conversation.title ?? other?.user.name ?? other?.user.email ?? "Gesprek";
  const ordered = [...conversation.messages].reverse();
  const lastId = ordered.length ? ordered[ordered.length - 1].id : "empty";

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-2xl flex-col px-4 py-4">
      <ChatAutoRefresh />

      <div className="shrink-0">
        <Link href="/messages" className="text-sm text-muted-foreground hover:text-foreground">
          ← Berichten
        </Link>
        <h1 className="mt-1 truncate text-xl font-bold">{title}</h1>

        {conversation.type === "group" && (
          <div className="mt-2 rounded-lg border border-border bg-card p-3 text-sm">
            <div className="mb-2 truncate text-muted-foreground">
              {conversation.members.map((m) => m.user.name ?? m.user.email).join(", ")}
            </div>
            <form action={addGroupMember} className="flex gap-2">
              <input type="hidden" name="conversationId" value={conversation.id} />
              <input
                name="email"
                type="email"
                required
                placeholder="Lid toevoegen (e-mail)…"
                className="min-w-0 flex-1 rounded-md border border-input px-2 py-1 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" className="shrink-0">
                +
              </Button>
            </form>
          </div>
        )}
      </div>

      <ChatScroll
        dep={lastId}
        className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted p-4"
      >
        {ordered.map((msg, i) => {
          const mine = msg.sender.id === me;
          const prev = ordered[i - 1];
          const showMeta = !prev || prev.sender.id !== msg.sender.id;
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <div className="w-7 shrink-0">
                  {showMeta && (
                    <Avatar src={msg.sender.image} name={msg.sender.name ?? msg.sender.email} size={28} />
                  )}
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-brand text-white" : "bg-card text-foreground ring-1 ring-border"
                }`}
              >
                {!mine && showMeta && (
                  <div className="mb-0.5 text-xs font-medium text-muted-foreground">
                    {msg.sender.name ?? msg.sender.email}
                  </div>
                )}
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                <span
                  className={`mt-0.5 block text-right text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}
                >
                  {timeAgo(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        {ordered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nog geen berichten.</p>
        )}
      </ChatScroll>

      <form action={sendMessage} className="mt-3 flex shrink-0 gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <input
          name="content"
          required
          autoComplete="off"
          placeholder="Typ een bericht…"
          className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        />
        <Button type="submit" variant="brand" className="shrink-0">
          Stuur
        </Button>
      </form>
    </div>
  );
}
