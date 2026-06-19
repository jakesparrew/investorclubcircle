import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { resolveSegment } from "@/lib/segments-query";
import { sendSegmentMessage } from "@/lib/segments";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; tagId?: string; activity?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter = { tier: sp.tier ?? "", tagId: sp.tagId ?? "", activity: sp.activity ?? "" };

  let tags: { id: string; name: string }[] = [];
  let result = { count: 0, sample: [] as { id: string; name: string | null; email: string; image: string | null }[] };
  let dbError = false;
  try {
    [tags, result] = await Promise.all([
      db.memberTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      resolveSegment(filter),
    ]);
  } catch {
    dbError = true;
  }

  const tierOpts = [
    { v: "", label: "Alle tiers" },
    { v: "free", label: "Gratis" },
    { v: "basis", label: "Basis" },
    { v: "premium", label: "Premium" },
  ];
  const activityOpts = [
    { v: "", label: "Alle activiteit" },
    { v: "active", label: "Actief (14d)" },
    { v: "inactive", label: "Inactief (14d)" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Segment kiezen</h2>
          <form method="GET" className="flex flex-wrap gap-2">
            <select name="tier" defaultValue={filter.tier} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {tierOpts.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <select name="tagId" defaultValue={filter.tagId} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Alle tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select name="activity" defaultValue={filter.activity} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {activityOpts.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="outline">
              Toon segment
            </Button>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm">
            <span className="text-2xl font-bold">{result.count}</span>{" "}
            <span className="text-muted-foreground">leden in dit segment</span>
          </div>
          {result.count > 0 && (
            <a
              href={`/api/admin/export/segment?${new URLSearchParams({
                ...(filter.tier ? { tier: filter.tier } : {}),
                ...(filter.tagId ? { tagId: filter.tagId } : {}),
                ...(filter.activity ? { activity: filter.activity } : {}),
              })}`}
              className="shrink-0 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              ⬇ CSV
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {result.sample.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs">
              <Avatar src={u.image} name={u.name ?? u.email} size={20} />
              <span className="max-w-[160px] truncate">{u.name ?? u.email}</span>
            </div>
          ))}
          {result.count > result.sample.length && (
            <span className="self-center text-xs text-muted-foreground">
              +{result.count - result.sample.length} meer
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Bericht naar dit segment</h2>
          <form action={sendSegmentMessage} className="flex flex-col gap-3">
            <input type="hidden" name="tier" value={filter.tier} />
            <input type="hidden" name="tagId" value={filter.tagId} />
            <input type="hidden" name="activity" value={filter.activity} />
            <Input name="title" placeholder="Titel van de aankondiging" required />
            <textarea
              name="body"
              rows={2}
              placeholder="Boodschap…"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Input name="link" placeholder="Link (optioneel, bv. /events/...)" />
            <div>
              <Button type="submit" variant="brand">
                Verstuur naar {result.count} leden
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Stuurt een in-app melding naar alle leden in het huidige segment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
