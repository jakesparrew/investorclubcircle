import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createSpaceGroup, createSpace } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type GroupWithSpaces = Prisma.SpaceGroupGetPayload<{ include: { spaces: true } }>;

export default async function AdminSpacesPage() {
  await requireAdminPage();
  let groups: GroupWithSpaces[] = [];
  let dbError = false;
  try {
    groups = await db.spaceGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: { spaces: { orderBy: { sortOrder: "asc" } } },
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 font-semibold">Nieuwe groep</h2>
            <form action={createSpaceGroup} className="flex gap-2">
              <Input name="name" placeholder="Groepsnaam" required />
              <Button type="submit">Toevoegen</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 font-semibold">Nieuwe space</h2>
            <form action={createSpace} className="flex flex-col gap-2">
              <select name="spaceGroupId" required className="h-10 rounded-md border border-neutral-300 px-2 text-sm">
                <option value="">Kies groep…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Spacenaam" required />
              <Input name="description" placeholder="Beschrijving" />
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isPublic" /> Publiek
                </label>
                <select name="minTier" className="h-9 rounded-md border border-neutral-300 px-2">
                  <option value="">free</option>
                  <option value="basis">basis</option>
                  <option value="premium">premium</option>
                </select>
              </div>
              <Button type="submit">Aanmaken</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.id}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.name}</h3>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {g.spaces.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                  <span>{s.name}</span>
                  <Badge variant="secondary">{s.isPublic ? "publiek" : (s.minTier ?? "free")}</Badge>
                </div>
              ))}
              {g.spaces.length === 0 && <div className="p-3 text-sm text-neutral-400">Nog geen spaces.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
