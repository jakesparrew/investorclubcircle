import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startDirectByEmail, createGroup } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Berichten — InvestorClub" };

type Membership = Prisma.ConversationMemberGetPayload<{
  include: {
    conversation: {
      include: {
        members: { include: { user: { select: { id: true; name: true; email: true; image: true } } } };
        messages: true;
      };
    };
  };
}>;

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/messages");

  let memberships: Membership[] = [];
  let dbError = false;
  try {
    memberships = await db.conversationMember.findMany({
      where: { userId: session.user.id },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
            messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });
    memberships.sort(
      (a, b) =>
        (b.conversation.messages[0]?.createdAt.getTime() ?? 0) -
        (a.conversation.messages[0]?.createdAt.getTime() ?? 0),
    );
  } catch {
    dbError = true;
  }

  const me = session.user.id;
  const otherOf = (m: Membership) => m.conversation.members.find((x) => x.user.id !== me)?.user;
  const labelOf = (m: Membership) =>
    m.conversation.title ?? otherOf(m)?.name ?? otherOf(m)?.email ?? "Onbekend";
  const isUnread = (m: Membership) => {
    const last = m.conversation.messages[0];
    if (!last || last.senderId === me) return false;
    return !m.lastReadAt || last.createdAt > m.lastReadAt;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Berichten</h1>
      <p className="mb-6 text-sm text-neutral-500">Directe gesprekken met andere leden.</p>

      <Card className="mb-3">
        <CardContent className="pt-6">
          <form action={startDirectByEmail} className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" name="email" placeholder="E-mail van het lid…" required className="min-w-0" />
            <Button type="submit" variant="brand" className="shrink-0">
              Start gesprek
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form action={createGroup} className="flex flex-col gap-2 sm:flex-row">
            <Input name="title" placeholder="Naam nieuwe groep…" required className="min-w-0" />
            <Button type="submit" variant="outline" className="shrink-0">
              Maak groep
            </Button>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {memberships.map((m) => {
          const last = m.conversation.messages[0];
          const unread = isUnread(m);
          const other = otherOf(m);
          return (
            <Link
              key={m.conversationId}
              href={`/messages/${m.conversationId}`}
              className="flex items-center gap-3 p-4 hover:bg-neutral-50"
            >
              <Avatar
                src={m.conversation.type === "group" ? null : other?.image}
                name={labelOf(m)}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate ${unread ? "font-semibold text-neutral-900" : "font-medium"}`}>
                    {labelOf(m)}
                  </span>
                  {last && (
                    <span className="shrink-0 text-xs text-neutral-400">{timeAgo(last.createdAt)}</span>
                  )}
                </div>
                <div
                  className={`line-clamp-1 text-sm ${unread ? "font-medium text-neutral-700" : "text-neutral-500"}`}
                >
                  {last?.content ?? "Nog geen berichten"}
                </div>
              </div>
              {unread && <span className="size-2.5 shrink-0 rounded-full bg-brand" aria-label="Ongelezen" />}
            </Link>
          );
        })}
        {memberships.length === 0 && !dbError && (
          <p className="p-6 text-center text-sm text-neutral-400">
            Nog geen gesprekken. Start er één hierboven.
          </p>
        )}
      </div>
    </div>
  );
}
