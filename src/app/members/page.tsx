import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startDirectByUserId } from "@/lib/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leden — InvestorClub" };

type MemberCard = Prisma.UserGetPayload<{ include: { profile: true } }>;

const PAGE = 30;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/members");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const limit = Math.min(Math.max(parseInt(sp.limit ?? `${PAGE}`, 10) || PAGE, PAGE), 300);

  let members: MemberCard[] = [];
  let hasMore = false;
  let dbError = false;
  try {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { profile: { headline: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {};
    const rows = await db.user.findMany({
      where,
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    hasMore = rows.length > limit;
    members = rows.slice(0, limit);
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Leden</h1>
      <p className="mb-6 text-sm text-neutral-500">De community van InvestorClub.</p>

      <form method="GET" className="mb-8 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Zoek op naam, e-mail of functie…"
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
        <Button type="submit" variant="brand" className="shrink-0">
          Zoek
        </Button>
      </form>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      {q && (
        <p className="mb-4 text-sm text-neutral-500">
          {members.length === 0 ? "Geen leden gevonden voor" : "Resultaten voor"} “{q}” ·{" "}
          <Link href="/members" className="underline">
            wis
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={m.image} name={m.name} size={36} />
              <div className="min-w-0">
                <Link href={`/members/${m.id}`} className="block truncate font-medium hover:underline">
                  {m.name ?? "Lid"}
                </Link>
                {m.profile?.headline && (
                  <div className="truncate text-sm text-neutral-500">{m.profile.headline}</div>
                )}
              </div>
            </div>
            {m.id !== session.user.id && (
              <form action={startDirectByUserId} className="shrink-0">
                <input type="hidden" name="userId" value={m.id} />
                <Button type="submit" size="sm" variant="outline">
                  Bericht
                </Button>
              </form>
            )}
          </div>
        ))}
        {members.length === 0 && !dbError && !q && (
          <p className="col-span-full text-center text-sm text-neutral-400">Nog geen leden.</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            href={`/members?${new URLSearchParams({ ...(q ? { q } : {}), limit: `${limit + PAGE}` })}`}
            className="inline-block rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Toon meer
          </Link>
        </div>
      )}
    </div>
  );
}
