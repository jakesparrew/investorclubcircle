import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { registerForEvent } from "@/lib/events";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type EventDetail = Prisma.EventGetPayload<{ include: { host: { select: { name: true; email: true; image: true } } } }>;

const REGISTERED_COPY: Record<string, string> = {
  success: "Je inschrijving is bevestigd. Tot dan!",
  waitlist: "Het event is vol — je staat op de wachtlijst.",
  cancelled: "Betaling geannuleerd — je bent niet ingeschreven.",
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registered?: string }>;
}) {
  const { slug } = await params;
  const { registered } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/events/${slug}`);

  let event: EventDetail | null = null;
  try {
    event = await db.event.findUnique({
      where: { slug },
      include: { host: { select: { name: true, email: true, image: true } } },
    });
  } catch {
    return <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">Database nog niet gekoppeld.</p>;
  }
  if (!event) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(event)).ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Geen toegang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-neutral-600">
            <p>Dit event is voorbehouden aan {event.minTier ?? "leden"}.</p>
            <Link href="/pricing">
              <Button variant="brand" className="w-full">
                Bekijk lidmaatschappen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [registration, confirmedCount] = await Promise.all([
    db.registration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
    }),
    db.registration.count({ where: { eventId: event.id, status: { in: ["confirmed", "pending"] } } }),
  ]);

  const isHost = event.hostId === session.user.id || session.user.role === "ADMIN";
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - confirmedCount) : null;
  const day = new Intl.DateTimeFormat("nl-BE", { day: "numeric" }).format(event.startsAt);
  const month = new Intl.DateTimeFormat("nl-BE", { month: "short" }).format(event.startsAt).replace(".", "");
  const fullDate = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long" }).format(event.startsAt);
  const time = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(event.startsAt);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/events" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Events
      </Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Avatar src={event.host.image} name={event.host.name ?? event.host.email} size={24} />
            Gehost door {event.host.name ?? event.host.email}
          </div>

          {registered && REGISTERED_COPY[registered] && (
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {REGISTERED_COPY[registered]}
            </p>
          )}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-400">Details</h2>
          {event.description && (
            <p className="mt-2 whitespace-pre-wrap text-neutral-700">{event.description}</p>
          )}
          <ul className="mt-4 flex flex-col gap-1 text-sm text-neutral-600">
            <li>📅 {fullDate} · {time}</li>
            {event.location && <li>📍 {event.location}</li>}
            <li>
              🎟️ Leden:{" "}
              {event.depositAmount
                ? `${formatMoney(event.depositAmount)} waarborg (terugbetaald bij opdagen)`
                : "gratis"}{" "}
              · Niet-leden: {event.nonMemberPrice ? formatMoney(event.nonMemberPrice) : "gratis"}
            </li>
          </ul>
        </div>

        {/* Sticky RSVP card */}
        <aside className="h-fit lg:sticky lg:top-20">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-14 flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white">
                  <span className="text-xs uppercase text-neutral-400">{month}</span>
                  <span className="text-xl font-bold leading-none">{day}</span>
                </div>
                <div className="text-sm">
                  <div className="font-medium capitalize">{fullDate}</div>
                  <div className="text-neutral-500">{time}</div>
                </div>
              </div>

              {spotsLeft != null && (
                <div className="text-sm text-neutral-500">
                  {spotsLeft} van {event.capacity} plaatsen vrij
                </div>
              )}

              {registration ? (
                <Badge variant={registration.status === "waitlisted" ? "warning" : "success"}>
                  {registration.status === "waitlisted"
                    ? `Wachtlijst #${registration.waitlistPosition}`
                    : `Ingeschreven (${registration.status})`}
                </Badge>
              ) : (
                <form action={registerForEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" variant="brand" className="w-full">
                    Schrijf je in
                  </Button>
                </form>
              )}

              {isHost && (
                <Link href={`/events/${slug}/checkin`} className="text-center text-sm font-medium underline">
                  Check-in beheren
                </Link>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
