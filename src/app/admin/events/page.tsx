import Link from "next/link";
import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createEvent } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireAdminPage();
  let events: Event[] = [];
  let dbError = false;
  try {
    events = await db.event.findMany({ orderBy: { startsAt: "desc" }, take: 50 });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuw event</h2>
          <form action={createEvent} className="grid gap-3 sm:grid-cols-2">
            <Input name="title" placeholder="Titel" required className="sm:col-span-2" />
            <Input name="location" placeholder="Locatie" />
            <Input name="startsAt" type="datetime-local" />
            <Input name="capacity" type="number" placeholder="Capaciteit" />
            <select name="minTier" className="h-10 rounded-md border border-neutral-300 px-2 text-sm">
              <option value="">Min. tier: free</option>
              <option value="basis">basis</option>
              <option value="premium">premium</option>
            </select>
            <Input name="depositAmount" placeholder="Waarborg leden (€, bv. 1)" />
            <Input name="nonMemberPrice" placeholder="Prijs niet-leden (€, bv. 29)" />
            <textarea
              name="description"
              placeholder="Beschrijving"
              rows={2}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPublic" /> Publiek
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Aanmaken</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <Link href={`/events/${e.slug}`} className="font-medium hover:underline">
                {e.title}
              </Link>
              <div className="text-xs text-neutral-400">
                {new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" }).format(e.startsAt)}
                {e.depositAmount ? ` · waarborg ${formatMoney(e.depositAmount)}` : ""}
              </div>
            </div>
            <Badge variant="secondary">{e.status}</Badge>
          </div>
        ))}
        {events.length === 0 && !dbError && <p className="text-sm text-neutral-400">Nog geen events.</p>}
      </div>
    </div>
  );
}
