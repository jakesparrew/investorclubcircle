import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLeaderboard, type LeaderboardRow } from "@/lib/points";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard — InvestorClub" };

const RANGES = [
  { key: "7d", label: "7 dagen", days: 7 },
  { key: "30d", label: "30 dagen", days: 30 },
  { key: "all", label: "Aller tijden", days: null as number | null },
] as const;

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[2];
  const since = range.days ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000) : undefined;

  let rows: LeaderboardRow[] = [];
  let levels: { name: string; minPoints: number }[] = [];
  let dbError = false;
  try {
    rows = await getLeaderboard(25, since);
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

  const meId = session?.user?.id;
  const meRow = meId ? rows.find((r) => r.userId === meId) : undefined;
  const meRank = meRow ? rows.findIndex((r) => r.userId === meId) + 1 : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Verdien punten door te posten, reageren en deel te nemen.
      </p>

      <div className="mb-6 inline-flex rounded-full border border-neutral-200 bg-white p-1">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/leaderboard?range=${r.key}`}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              r.key === range.key
                ? "bg-brand font-medium text-white"
                : "text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — de ranglijst verschijnt zodra de verbinding live is.
        </p>
      )}

      {meRow && meRank && meRank > 10 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 p-4">
          <div className="flex items-center gap-3">
            <span className="w-6 text-center font-semibold text-brand">{meRank}</span>
            <Avatar src={meRow.image} name={meRow.name} size={36} />
            <div className="font-medium">Jij</div>
          </div>
          <span className="font-semibold">{meRow.points} pt</span>
        </div>
      )}

      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {rows.map((row, i) => {
          const isMe = row.userId === meId;
          return (
            <div
              key={row.userId}
              className={`flex items-center justify-between p-4 ${isMe ? "bg-brand/5" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 text-center text-lg font-semibold text-neutral-400">
                  {i < 3 ? MEDALS[i] : <span className="text-sm">{i + 1}</span>}
                </span>
                <Avatar src={row.image} name={row.name} size={36} />
                <div className="min-w-0">
                  <Link
                    href={`/members/${row.userId}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {row.name ?? row.email}
                    {isMe && <span className="ml-1 text-xs text-brand">· jij</span>}
                  </Link>
                  <Badge variant="secondary">{levelName(row.points)}</Badge>
                </div>
              </div>
              <span className="shrink-0 font-semibold">{row.points} pt</span>
            </div>
          );
        })}
        {rows.length === 0 && !dbError && (
          <p className="p-6 text-center text-sm text-neutral-400">
            Nog geen punten verdiend in deze periode.
          </p>
        )}
      </div>
    </div>
  );
}
