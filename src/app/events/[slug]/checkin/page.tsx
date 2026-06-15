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

export default async function CheckinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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

  const attendees = event.registrations.filter((r) => r.status !== "cancelled");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/events/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900">
        ← {event.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Check-in</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {attendees.filter((r) => r.checkedInAt).length} / {attendees.length} ingecheckt
      </p>

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {attendees.map((reg) => (
          <div key={reg.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium">{reg.user.name ?? reg.user.email}</div>
              <div className="text-xs text-neutral-400">
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
        {attendees.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-400">Nog geen inschrijvingen.</p>
        )}
      </div>
    </div>
  );
}
