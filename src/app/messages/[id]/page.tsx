import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendMessage, addGroupMember } from "@/lib/chat";
import { ChatAutoRefresh } from "@/components/ChatAutoRefresh";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type ConversationDetail = Prisma.ConversationGetPayload<{
  include: {
    members: { include: { user: { select: { id: true; name: true; email: true } } } };
    messages: { include: { sender: { select: { id: true; name: true; email: true } } } };
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
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        messages: {
          where: { deletedAt: null },
          include: { sender: { select: { id: true, name: true, email: true } } },
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

  const me = session.user.id;
  const other = conversation.members.find((m) => m.user.id !== me);
  const title = conversation.title ?? other?.user.name ?? other?.user.email ?? "Gesprek";

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-8">
      <ChatAutoRefresh />
      <Link href="/messages" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Berichten
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-bold">{title}</h1>

      {conversation.type === "group" && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
          <div className="mb-2 text-neutral-500">
            {conversation.members.map((m) => m.user.name ?? m.user.email).join(", ")}
          </div>
          <form action={addGroupMember} className="flex gap-2">
            <input type="hidden" name="conversationId" value={conversation.id} />
            <input
              name="email"
              type="email"
              required
              placeholder="Lid toevoegen (e-mail)…"
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              +
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {[...conversation.messages].reverse().map((msg) => {
          const mine = msg.sender.id === me;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
                }`}
              >
                {!mine && (
                  <div className="mb-0.5 text-xs font-medium opacity-70">
                    {msg.sender.name ?? msg.sender.email}
                  </div>
                )}
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          );
        })}
        {conversation.messages.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">Nog geen berichten.</p>
        )}
      </div>

      <form action={sendMessage} className="mt-6 flex gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <input
          name="content"
          required
          autoComplete="off"
          placeholder="Typ een bericht…"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
        <Button type="submit">Stuur</Button>
      </form>
    </div>
  );
}
