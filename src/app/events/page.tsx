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

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Events</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Reserveer je plek. Leden betalen een terugbetaalbare waarborg van €1.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — events verschijnen zodra de verbinding live is.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map(({ event, accessible }) => (
          <div key={event.id} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{event.title}</div>
                <div className="text-sm text-neutral-500">
                  {fmtDate(event.startsAt)}
                  {event.location ? ` · ${event.location}` : ""}
                </div>
              </div>
              {accessible ? (
                <Link href={`/events/${event.slug}`}>
                  <Badge>Bekijk</Badge>
                </Link>
              ) : (
                <Link href="/pricing">
                  <Badge variant="warning">🔒 {event.minTier ?? "leden"}</Badge>
                </Link>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && !dbError && (
          <p className="text-center text-sm text-neutral-400">Nog geen events gepland.</p>
        )}
      </div>
    </div>
  );
}
