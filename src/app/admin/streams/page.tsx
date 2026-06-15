import type { Livestream } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createStream, setStreamStatus } from "@/lib/streams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUSES = ["scheduled", "live", "ended"] as const;

export default async function AdminStreamsPage() {
  await requireAdminPage();
  let streams: Livestream[] = [];
  let dbError = false;
  try {
    streams = await db.livestream.findMany({ orderBy: { createdAt: "desc" } });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuwe livestream</h2>
          <form action={createStream} className="flex flex-col gap-3">
            <Input name="title" placeholder="Titel" required />
            <Input name="embedUrl" placeholder="YouTube embed-URL (https://www.youtube.com/embed/…)" required />
            <Input name="description" placeholder="Beschrijving (optioneel)" />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isPublic" /> Publiek
              </label>
              <label className="flex items-center gap-2">
                Min. tier:
                <select name="minTier" className="h-9 rounded-md border border-neutral-300 px-2">
                  <option value="">free</option>
                  <option value="basis">basis</option>
                  <option value="premium">premium</option>
                </select>
              </label>
            </div>
            <div>
              <Button type="submit">Aanmaken</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-3">
        {streams.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.title}</span>
                <Badge variant={s.status === "live" ? "danger" : "secondary"}>{s.status}</Badge>
                <Badge variant="secondary">{s.isPublic ? "publiek" : (s.minTier ?? "free")}</Badge>
              </div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <form key={st} action={setStreamStatus}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="status" value={st} />
                  <Button type="submit" size="sm" variant={s.status === st ? "default" : "ghost"}>
                    {st}
                  </Button>
                </form>
              ))}
            </div>
          </div>
        ))}
        {streams.length === 0 && !dbError && (
          <p className="text-sm text-neutral-400">Nog geen streams.</p>
        )}
      </div>
    </div>
  );
}
