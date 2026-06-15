import { db } from "@/lib/db";
import { getLeaderboard, type LeaderboardRow } from "@/lib/points";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard — InvestorClub" };

export default async function LeaderboardPage() {
  let rows: LeaderboardRow[] = [];
  let levels: { name: string; minPoints: number }[] = [];
  let dbError = false;
  try {
    rows = await getLeaderboard(25);
    const org = await db.organization.findFirst();
    if (org) {
      levels = await db.level.findMany({
        where: { orgId: org.id },
        orderBy: { minPoints: "asc" },
        select: { name: true, minPoints: true },
      });
    }
  } catch {
    dbError = true;
  }

  function levelName(points: number): string {
    let name = "—";
    for (const l of levels) if (points >= l.minPoints) name = l.name;
    return name;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Verdien punten door te posten, reageren en deel te nemen.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — de ranglijst verschijnt zodra de verbinding live is.
        </p>
      )}

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {rows.map((row, i) => (
          <div key={row.userId} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center font-semibold text-neutral-400">{i + 1}</span>
              <div>
                <div className="font-medium">{row.name ?? row.email}</div>
                <Badge variant="secondary">{levelName(row.points)}</Badge>
              </div>
            </div>
            <span className="font-semibold">{row.points} pt</span>
          </div>
        ))}
        {rows.length === 0 && !dbError && (
          <p className="p-6 text-center text-sm text-neutral-400">Nog geen punten verdiend.</p>
        )}
      </div>
    </div>
  );
}
