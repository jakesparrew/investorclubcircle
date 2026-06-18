import Link from "next/link";
import { redirect } from "next/navigation";
import type { Event } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events — InvestorClub" };

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/events");

  let rows: { event: Event; accessible: boolean }[] = [];
  let dbError = false;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const events = await db.event.findMany({
      where: { status: "published" },
      orderBy: { startsAt: "asc" },
      take: 50,
    });
    rows = events.map((e) => ({ event: e, accessible: canAccess(ctx, spaceRequirement(e)).ok }));
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold">Events</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Reserveer je plek. Leden betalen een terugbetaalbare waarborg van €1.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ event, accessible }) => {
          const day = new Intl.DateTimeFormat("nl-BE", { day: "numeric" }).format(event.startsAt);
          const month = new Intl.DateTimeFormat("nl-BE", { month: "short" })
            .format(event.startsAt)
            .replace(".", "");
          const time = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(
            event.startsAt,
          );
          const inner = (
            <div className="flex h-full gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300">
              <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface">
                <span className="text-xs uppercase text-neutral-400">{month}</span>
                <span className="text-xl font-bold leading-none">{day}</span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{event.title}</div>
                <div className="text-sm text-neutral-500">
                  {time}
                  {event.location ? ` · ${event.location}` : ""}
                </div>
                {!accessible && (
                  <Badge variant="warning" className="mt-2">
                    🔒 {event.minTier ?? "leden"}
                  </Badge>
                )}
              </div>
            </div>
          );
          return accessible ? (
            <Link key={event.id} href={`/events/${event.slug}`}>
              {inner}
            </Link>
          ) : (
            <Link key={event.id} href="/pricing">
              {inner}
            </Link>
          );
        })}
        {rows.length === 0 && !dbError && (
          <p className="col-span-full text-center text-sm text-neutral-400">Nog geen events gepland.</p>
        )}
      </div>
    </div>
  );
}
