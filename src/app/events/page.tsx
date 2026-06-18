import Link from "next/link";
import { redirect } from "next/navigation";
import type { Event } from "@prisma/client";
import { Repeat, Video } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Events — InvestorClub" };

type Row = { event: Event; accessible: boolean };

function EventCard({ event, accessible, past }: { event: Event; accessible: boolean; past?: boolean }) {
  const day = new Intl.DateTimeFormat("nl-BE", { day: "numeric" }).format(event.startsAt);
  const month = new Intl.DateTimeFormat("nl-BE", { month: "short" })
    .format(event.startsAt)
    .replace(".", "");
  const time = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(
    event.startsAt,
  );
  const endTime = event.endsAt
    ? new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(event.endsAt)
    : null;
  const recurring = Boolean(event.recurrenceRule || event.seriesId);

  const inner = (
    <div
      className={`flex h-full gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 ${
        past ? "opacity-70" : ""
      }`}
    >
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface">
        <span className="text-xs uppercase text-neutral-400">{month}</span>
        <span className="text-xl font-bold leading-none">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold break-words">{event.title}</div>
        <div className="text-sm text-neutral-500">
          {time}
          {endTime ? `–${endTime}` : ""}
          {event.location ? ` · ${event.location}` : ""}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {recurring && (
            <Badge variant="secondary" className="gap-1">
              <Repeat className="size-3" /> Terugkerend
            </Badge>
          )}
          {past && event.recordingUrl && (
            <Badge variant="secondary" className="gap-1">
              <Video className="size-3" /> Opname
            </Badge>
          )}
          {!accessible && <Badge variant="warning">🔒 {event.minTier ?? "leden"}</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <Link href={accessible ? `/events/${event.slug}` : "/pricing"} className="block">
      {inner}
    </Link>
  );
}

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/events");

  let upcoming: Row[] = [];
  let past: Row[] = [];
  let dbError = false;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const now = new Date();
    const [up, pa] = await Promise.all([
      db.event.findMany({
        where: { status: "published", startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 50,
      }),
      db.event.findMany({
        where: { status: "published", startsAt: { lt: now } },
        orderBy: { startsAt: "desc" },
        take: 20,
      }),
    ]);
    upcoming = up.map((e) => ({ event: e, accessible: canAccess(ctx, spaceRequirement(e)).ok }));
    past = pa.map((e) => ({ event: e, accessible: canAccess(ctx, spaceRequirement(e)).ok }));
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

      {upcoming.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {upcoming.map(({ event, accessible }) => (
            <EventCard key={event.id} event={event} accessible={accessible} />
          ))}
        </div>
      )}

      {upcoming.length === 0 && !dbError && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-sm text-neutral-500">Nog geen geplande events.</p>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Afgelopen
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {past.map(({ event, accessible }) => (
              <EventCard key={event.id} event={event} accessible={accessible} past />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
