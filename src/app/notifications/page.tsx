import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, type Notification } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meldingen — InvestorClub" };

function message(n: Notification): { text: string; link?: string } {
  const p = (n.payload ?? {}) as { link?: string; by?: string; title?: string; body?: string };
  const by = p.by ?? "Iemand";
  if (n.type === "comment") return { text: `${by} reageerde op ${p.title ?? "je post"}`, link: p.link };
  if (n.type === "reply") return { text: `${by} antwoordde op je reactie`, link: p.link };
  if (n.type === "message") return { text: `${by} stuurde je een bericht`, link: p.link };
  if (n.type === "announcement")
    return { text: `📣 ${p.title ?? "Aankondiging"}${p.body ? ` — ${p.body}` : ""}`, link: p.link };
  return { text: n.type, link: p.link };
}

const FILTERS = [
  { k: "all", l: "Alles" },
  { k: "unread", l: "Ongelezen" },
  { k: "message", l: "Berichten" },
  { k: "reactions", l: "Reacties" },
  { k: "announcement", l: "Aankondigingen" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/notifications");

  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.k === sp.filter) ? sp.filter! : "all";

  let notifs: Notification[] = [];
  let dbError = false;
  try {
    const where: Prisma.NotificationWhereInput = { userId: session.user.id };
    if (filter === "unread") where.readAt = null;
    else if (filter === "message") where.type = "message";
    else if (filter === "reactions") where.type = { in: ["comment", "reply"] };
    else if (filter === "announcement") where.type = "announcement";
    notifs = await db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 });
  } catch {
    dbError = true;
  }

  const unread = notifs.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meldingen</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" size="sm" variant="outline">
              Alles gelezen ({unread})
            </Button>
          </form>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.k}
            href={`/notifications?filter=${f.k}`}
            className={`rounded-full border px-3 py-1 transition-colors ${
              filter === f.k
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.l}
          </Link>
        ))}
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {notifs.map((n) => {
          const m = message(n);
          return (
            <div key={n.id} className="flex items-center gap-2 p-4">
              {m.link ? (
                <Link
                  href={m.link}
                  className={`min-w-0 flex-1 text-sm ${n.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                >
                  {m.text}
                </Link>
              ) : (
                <span
                  className={`min-w-0 flex-1 text-sm ${n.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                >
                  {m.text}
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              {!n.readAt && (
                <form action={markNotificationRead} className="shrink-0">
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className="rounded-md p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Markeer als gelezen"
                    title="Markeer als gelezen"
                  >
                    ✓
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {notifs.length === 0 && !dbError && (
          <p className="p-6 text-center text-sm text-muted-foreground">Geen meldingen.</p>
        )}
      </div>
    </div>
  );
}
