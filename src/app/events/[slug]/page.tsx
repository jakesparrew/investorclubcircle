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
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
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

  const [registration, confirmedCount, attendees] = await Promise.all([
    db.registration.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
    }),
    db.registration.count({ where: { eventId: event.id, status: { in: ["confirmed", "pending"] } } }),
    db.registration.findMany({
      where: { eventId: event.id, status: { in: ["confirmed", "pending"] } },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
  ]);

  const isHost = event.hostId === session.user.id || session.user.role === "ADMIN";
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - confirmedCount) : null;
  const recurring = Boolean(event.recurrenceRule || event.seriesId);
  const isPast = event.startsAt.getTime() < Date.now();
  const day = new Intl.DateTimeFormat("nl-BE", { day: "numeric" }).format(event.startsAt);
  const month = new Intl.DateTimeFormat("nl-BE", { month: "short" }).format(event.startsAt).replace(".", "");
  const fullDate = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long" }).format(event.startsAt);
  const time = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(event.startsAt);
  const endTime = event.endsAt
    ? new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" }).format(event.endsAt)
    : null;
  const timeRange = endTime ? `${time}–${endTime}` : time;

  const gcalFmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcalEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000);
  const googleCalUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE&" +
    new URLSearchParams({
      text: event.title,
      dates: `${gcalFmt(event.startsAt)}/${gcalFmt(gcalEnd)}`,
      details: event.description ?? "",
      location: event.location ?? "",
    }).toString();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
        ← Events
      </Link>

      {event.coverImage && (
        <div className="mt-3 aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.coverImage} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mt-3 grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold break-words">{event.title}</h1>
            {recurring && <Badge variant="secondary">Terugkerend</Badge>}
            {isPast && <Badge variant="secondary">Afgelopen</Badge>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar src={event.host.image} name={event.host.name ?? event.host.email} size={24} />
            Gehost door {event.host.name ?? event.host.email}
          </div>

          {registered && REGISTERED_COPY[registered] && (
            <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {REGISTERED_COPY[registered]}
            </p>
          )}

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Details</h2>
          {event.description && (
            <p className="mt-2 whitespace-pre-wrap text-foreground">{event.description}</p>
          )}
          <ul className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
            <li className="capitalize">📅 {fullDate} · {timeRange}</li>
            {event.location && <li>📍 {event.location}</li>}
            <li>
              🎟️ Leden:{" "}
              {event.depositAmount
                ? `${formatMoney(event.depositAmount)} waarborg (terugbetaald bij opdagen)`
                : "gratis"}{" "}
              · Niet-leden: {event.nonMemberPrice ? formatMoney(event.nonMemberPrice) : "gratis"}
            </li>
          </ul>

          {isPast && event.recordingUrl && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Opname</h2>
              <a
                href={event.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                ▶ Bekijk de opname
              </a>
            </div>
          )}

          {attendees.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Deelnemers ({confirmedCount})
              </h2>
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {attendees.map((a) => (
                    <Avatar
                      key={a.user.id}
                      src={a.user.image}
                      name={a.user.name}
                      size={32}
                      className="ring-2 ring-white"
                    />
                  ))}
                </div>
                {confirmedCount > attendees.length && (
                  <span className="ml-3 text-sm text-muted-foreground">
                    +{confirmedCount - attendees.length} meer
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky RSVP card */}
        <aside className="h-fit lg:sticky lg:top-20">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-14 flex-col items-center justify-center rounded-xl border border-border bg-card">
                  <span className="text-xs uppercase text-muted-foreground">{month}</span>
                  <span className="text-xl font-bold leading-none">{day}</span>
                </div>
                <div className="text-sm">
                  <div className="font-medium capitalize">{fullDate}</div>
                  <div className="text-muted-foreground">{timeRange}</div>
                </div>
              </div>

              {spotsLeft != null && (
                <div className="text-sm text-muted-foreground">
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

              {!isPast && (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Toevoegen aan agenda
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/events/${slug}/ics`}
                      className="flex-1 rounded-md border border-border px-3 py-1.5 text-center text-sm hover:bg-muted"
                    >
                      Apple / iCal
                    </a>
                    <a
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-md border border-border px-3 py-1.5 text-center text-sm hover:bg-muted"
                    >
                      Google
                    </a>
                  </div>
                </div>
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
