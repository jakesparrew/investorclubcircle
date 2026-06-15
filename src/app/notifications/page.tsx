import Link from "next/link";
import { redirect } from "next/navigation";
import type { Notification } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { markAllNotificationsRead } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meldingen — InvestorClub" };

function message(n: Notification): { text: string; link?: string } {
  const p = (n.payload ?? {}) as { link?: string; by?: string; title?: string };
  const by = p.by ?? "Iemand";
  if (n.type === "comment") return { text: `${by} reageerde op ${p.title ?? "je post"}`, link: p.link };
  if (n.type === "reply") return { text: `${by} antwoordde op je reactie`, link: p.link };
  return { text: n.type, link: p.link };
}

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/notifications");

  let notifs: Notification[] = [];
  let dbError = false;
  try {
    notifs = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    dbError = true;
  }

  const unread = notifs.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meldingen</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" size="sm" variant="outline">
              Alles gelezen ({unread})
            </Button>
          </form>
        )}
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {notifs.map((n) => {
          const m = message(n);
          const body = (
            <div className={`p-4 text-sm ${n.readAt ? "text-neutral-500" : "font-medium text-neutral-900"}`}>
              {m.text}
            </div>
          );
          return m.link ? (
            <Link key={n.id} href={m.link} className="block hover:bg-neutral-50">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
        {notifs.length === 0 && !dbError && (
          <p className="p-6 text-center text-sm text-neutral-400">Nog geen meldingen.</p>
        )}
      </div>
    </div>
  );
}
