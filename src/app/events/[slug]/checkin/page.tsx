import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkInRegistration } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type EventWithRegistrations = Prisma.EventGetPayload<{
  include: { registrations: { include: { user: { select: { name: true; email: true } } } } };
}>;

export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/events/${slug}/checkin`);

  let event: EventWithRegistrations | null = null;
  try {
    event = await db.event.findUnique({
      where: { slug },
      include: {
        registrations: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
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
  if (!event) notFound();
  if (event.hostId !== session.user.id && session.user.role !== "ADMIN") {
    redirect(`/events/${slug}`);
  }

  const notCancelled = event.registrations.filter((r) => r.status !== "cancelled");
  // Denominator = confirmed seats only; waitlisted aren't expected to attend.
  const confirmed = notCancelled.filter((r) => r.status !== "waitlisted");
  const checkedIn = confirmed.filter((r) => r.checkedInAt).length;
  const visible = query
    ? notCancelled.filter((r) =>
        `${r.user.name ?? ""} ${r.user.email}`.toLowerCase().includes(query),
      )
    : notCancelled;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/events/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Check-in</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {checkedIn} / {confirmed.length} ingecheckt
      </p>

      <form method="GET" className="mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Zoek op naam of e-mail…"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </form>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {visible.map((reg) => (
          <div key={reg.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{reg.user.name ?? reg.user.email}</div>
              <div className="text-xs text-muted-foreground">
                {reg.type}
                {reg.status === "waitlisted" ? ` · wachtlijst #${reg.waitlistPosition}` : ""}
              </div>
            </div>
            {reg.checkedInAt ? (
              <Badge variant="success">✓ Ingecheckt</Badge>
            ) : reg.status === "waitlisted" ? (
              <Badge variant="secondary">Wachtlijst</Badge>
            ) : (
              <form action={checkInRegistration}>
                <input type="hidden" name="registrationId" value={reg.id} />
                <Button type="submit" size="sm" variant="outline">
                  Check in
                </Button>
              </form>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {query ? "Geen inschrijvingen gevonden." : "Nog geen inschrijvingen."}
          </p>
        )}
      </div>
    </div>
  );
}
