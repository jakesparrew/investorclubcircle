import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { listAccessibleSpaceGroups } from "@/lib/spaces";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community — InvestorClub" };

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/community");

  let groups: Awaited<ReturnType<typeof listAccessibleSpaceGroups>> = [];
  let dbError = false;
  try {
    const org = await db.organization.findFirst();
    if (org) {
      const ctx = await getAccessContext(session.user.id, session.user.role);
      groups = await listAccessibleSpaceGroups(org.id, ctx);
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Community</h1>
      <p className="mb-8 text-sm text-neutral-500">Onderwerpkanalen voor leden en experts.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — spaces verschijnen zodra de verbinding live is.
        </p>
      )}

      {groups.length === 0 && !dbError && (
        <p className="text-sm text-neutral-500">Nog geen spaces. Voer de seed uit.</p>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <div key={group.id}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {group.name}
            </h2>
            <div className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              {group.spaces.map((space) =>
                space.accessible ? (
                  <Link
                    key={space.id}
                    href={`/community/${space.slug}`}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50"
                  >
                    <div>
                      <div className="font-medium">{space.name}</div>
                      {space.description && (
                        <div className="text-sm text-neutral-500">{space.description}</div>
                      )}
                    </div>
                    <span className="text-neutral-400">→</span>
                  </Link>
                ) : (
                  <div
                    key={space.id}
                    className="flex items-center justify-between p-4 opacity-70"
                  >
                    <div>
                      <div className="font-medium">{space.name}</div>
                      <div className="text-sm text-neutral-500">
                        {space.minTier ? `Vereist ${space.minTier}` : "Alleen leden"}
                      </div>
                    </div>
                    <Link href="/pricing">
                      <Badge variant="warning">🔒 Upgrade</Badge>
                    </Link>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
