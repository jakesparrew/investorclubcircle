import Link from "next/link";
import { redirect } from "next/navigation";
import type { Livestream } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live — InvestorClub" };

function statusBadge(status: string) {
  if (status === "live") return <Badge variant="danger">● LIVE</Badge>;
  if (status === "scheduled") return <Badge variant="secondary">Gepland</Badge>;
  return <Badge variant="secondary">Opname</Badge>;
}

export default async function LivePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/live");

  let rows: { stream: Livestream; accessible: boolean }[] = [];
  let dbError = false;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const streams = await db.livestream.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    rows = streams.map((s) => ({ stream: s, accessible: canAccess(ctx, spaceRequirement(s)).ok }));
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Live & opnames</h1>
      <p className="mb-8 text-sm text-neutral-500">Volg sessies live of bekijk de opname.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map(({ stream, accessible }) => (
          <div key={stream.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{stream.title}</span>
                {statusBadge(stream.status)}
              </div>
              {stream.description && <p className="text-sm text-neutral-500">{stream.description}</p>}
            </div>
            {accessible ? (
              <Link href={`/live/${stream.id}`}>
                <Badge>Bekijk</Badge>
              </Link>
            ) : (
              <Link href="/pricing">
                <Badge variant="warning">🔒 {stream.minTier ?? "leden"}</Badge>
              </Link>
            )}
          </div>
        ))}
        {rows.length === 0 && !dbError && (
          <p className="text-center text-sm text-neutral-400">Nog geen streams gepland.</p>
        )}
      </div>
    </div>
  );
}
