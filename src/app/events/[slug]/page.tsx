import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { registerForEvent } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "full", timeStyle: "short" }).format(d);
}

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

  let event: Awaited<ReturnType<typeof db.event.findUnique>> = null;
  try {
    event = await db.event.findUnique({ where: { slug } });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
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
              <Button className="w-full">Bekijk lidmaatschappen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [registration, confirmedCount] = await Promise.all([
    db.registration.findUnique({ where: { eventId_userId: { eventId: event.id, userId: session.user.id } } }),
    db.registration.count({ where: { eventId: event.id, status: { in: ["confirmed", "pending"] } } }),
  ]);

  const isHost = event.hostId === session.user.id || session.user.role === "ADMIN";
  const spotsLeft = event.capacity ? Math.max(0, event.capacity - confirmedCount) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/events" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Events
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{event.title}</h1>
      <div className="text-sm text-neutral-500">
        {fmtDate(event.startsAt)}
        {event.location ? ` · ${event.location}` : ""}
      </div>

      {registered && REGISTERED_COPY[registered] && (
        <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {REGISTERED_COPY[registered]}
        </p>
      )}

      {event.description && (
        <p className="mt-4 whitespace-pre-wrap text-neutral-700">{event.description}</p>
      )}

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Plaatsen</span>
            <span className="font-medium">
              {spotsLeft != null ? `${spotsLeft} van ${event.capacity} vrij` : "Onbeperkt"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Leden</span>
            <span className="font-medium">
              {event.depositAmount
                ? `${formatMoney(event.depositAmount)} waarborg (terugbetaald bij opdagen)`
                : "Gratis"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-500">Niet-leden</span>
            <span className="font-medium">
              {event.nonMemberPrice ? formatMoney(event.nonMemberPrice) : "Gratis"}
            </span>
          </div>

          {registration ? (
            <Badge variant={registration.status === "waitlisted" ? "warning" : "success"}>
              {registration.status === "waitlisted"
                ? `Wachtlijst #${registration.waitlistPosition}`
                : `Ingeschreven (${registration.status})`}
            </Badge>
          ) : (
            <form action={registerForEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <Button type="submit" className="w-full">
                Schrijf je in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {isHost && (
        <div className="mt-4">
          <Link href={`/events/${slug}/checkin`} className="text-sm font-medium underline">
            → Check-in beheren
          </Link>
        </div>
      )}
    </div>
  );
}
