import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, type Role } from "@prisma/client";
import { Search } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startDirectByUserId } from "@/lib/chat";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leden — InvestorClub" };

type MemberCard = Prisma.UserGetPayload<{ include: { profile: true } }>;

const PAGE = 30;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string; role?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/members");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const role = sp.role === "EXPERT" || sp.role === "MEMBER" || sp.role === "ADMIN" ? sp.role : "";
  const sort = sp.sort === "name" ? "name" : "new";
  const limit = Math.min(Math.max(parseInt(sp.limit ?? `${PAGE}`, 10) || PAGE, PAGE), 300);

  let members: MemberCard[] = [];
  let hasMore = false;
  let dbError = false;
  try {
    const and: Prisma.UserWhereInput[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { profile: { headline: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (role) and.push({ role: role as Role });
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};
    const rows = await db.user.findMany({
      where,
      include: { profile: true },
      orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      take: limit + 1,
    });
    hasMore = rows.length > limit;
    members = rows.slice(0, limit);
  } catch {
    dbError = true;
  }

  const buildHref = (over: { role?: string; sort?: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const rr = over.role !== undefined ? over.role : role;
    const ss = over.sort !== undefined ? over.sort : sort;
    if (rr) p.set("role", rr);
    if (ss && ss !== "new") p.set("sort", ss);
    if (over.limit) p.set("limit", String(over.limit));
    const s = p.toString();
    return `/members${s ? `?${s}` : ""}`;
  };
  const roleChips = [
    { k: "", l: "Iedereen" },
    { k: "EXPERT", l: "Experts" },
    { k: "MEMBER", l: "Leden" },
  ];
  const sortChips = [
    { k: "new", l: "Nieuwste" },
    { k: "name", l: "Naam A-Z" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Leden</h1>
      <p className="mb-6 text-sm text-muted-foreground">De community van InvestorClub.</p>

      <form method="GET" className="mb-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Zoek op naam, e-mail of functie…"
            className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="sort" value={sort} />
        <Button type="submit" variant="brand" className="shrink-0">
          Zoek
        </Button>
      </form>

      <div className="mb-8 flex flex-wrap items-center gap-1.5 text-sm">
        {roleChips.map((c) => (
          <Link
            key={c.k || "all"}
            href={buildHref({ role: c.k })}
            className={`rounded-full border px-3 py-1 transition-colors ${
              role === c.k
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {c.l}
          </Link>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {sortChips.map((c) => (
          <Link
            key={c.k}
            href={buildHref({ sort: c.k })}
            className={`rounded-full border px-3 py-1 transition-colors ${
              sort === c.k
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {c.l}
          </Link>
        ))}
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      {q && (
        <p className="mb-4 text-sm text-muted-foreground">
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
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={m.image} name={m.name} size={36} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link href={`/members/${m.id}`} className="truncate font-medium hover:underline">
                    {m.name ?? "Lid"}
                  </Link>
                  {m.role === "EXPERT" && <Badge variant="secondary">Expert</Badge>}
                  {m.role === "ADMIN" && <Badge variant="secondary">Admin</Badge>}
                </div>
                {m.profile?.headline && (
                  <div className="truncate text-sm text-muted-foreground">{m.profile.headline}</div>
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
          <p className="col-span-full text-center text-sm text-muted-foreground">Nog geen leden.</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            href={buildHref({ limit: limit + PAGE })}
            className="inline-block rounded-full border border-input bg-card px-5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Toon meer
          </Link>
        </div>
      )}
    </div>
  );
}
