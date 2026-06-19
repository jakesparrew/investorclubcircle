import Link from "next/link";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { setUserRoleAction } from "@/lib/admin";
import { requireAdminPage } from "@/lib/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ROLES = ["MEMBER", "EXPERT", "ADMIN"] as const;
const PAGE = 50;

type MemberRow = Prisma.UserGetPayload<{ include: { memberships: { include: { tier: true } } } }>;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; tier?: string; limit?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const role = ["MEMBER", "EXPERT", "ADMIN"].includes(sp.role ?? "") ? sp.role! : "";
  const tier = ["free", "basis", "premium"].includes(sp.tier ?? "") ? sp.tier! : "";
  const limit = Math.min(Math.max(parseInt(sp.limit ?? `${PAGE}`, 10) || PAGE, PAGE), 1000);

  let users: MemberRow[] = [];
  let hasMore = false;
  let dbError = false;
  try {
    const and: Prisma.UserWhereInput[] = [];
    if (q)
      and.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      });
    if (role) and.push({ role: role as Role });
    if (tier === "free") and.push({ memberships: { none: { status: { in: ["active", "trialing"] } } } });
    else if (tier)
      and.push({ memberships: { some: { status: { in: ["active", "trialing"] }, tier: { key: tier } } } });
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};
    const rows = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { tier: true } } },
      take: limit + 1,
    });
    hasMore = rows.length > limit;
    users = rows.slice(0, limit);
  } catch {
    dbError = true;
  }

  const href = (over: { role?: string; tier?: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const rr = over.role !== undefined ? over.role : role;
    const tt = over.tier !== undefined ? over.tier : tier;
    if (rr) p.set("role", rr);
    if (tt) p.set("tier", tt);
    if (over.limit) p.set("limit", String(over.limit));
    const s = p.toString();
    return `/admin/members${s ? `?${s}` : ""}`;
  };
  const exportHref = `/api/admin/export/members?${new URLSearchParams({
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
    ...(tier ? { tier } : {}),
  })}`;

  return (
    <div className="flex flex-col gap-4">
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Zoek op naam of e-mail…"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm"
        />
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="tier" value={tier} />
        <Button type="submit" size="sm" variant="brand">
          Zoek
        </Button>
        <a
          href={exportHref}
          className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          ⬇ CSV
        </a>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-xs text-muted-foreground">Rol:</span>
        {[
          { k: "", l: "Alle" },
          { k: "MEMBER", l: "Leden" },
          { k: "EXPERT", l: "Experts" },
          { k: "ADMIN", l: "Admins" },
        ].map((c) => (
          <Link
            key={c.k || "all"}
            href={href({ role: c.k })}
            className={`rounded-full border px-2.5 py-0.5 ${role === c.k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {c.l}
          </Link>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">Tier:</span>
        {[
          { k: "", l: "Alle" },
          { k: "free", l: "Gratis" },
          { k: "basis", l: "Basis" },
          { k: "premium", l: "Premium" },
        ].map((c) => (
          <Link
            key={c.k || "all"}
            href={href({ tier: c.k })}
            className={`rounded-full border px-2.5 py-0.5 ${tier === c.k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {c.l}
          </Link>
        ))}
      </div>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">E-mail</th>
              <th className="py-2 pr-4 font-medium">Lid sinds</th>
              <th className="py-2 pr-4 font-medium">Lidmaatschap</th>
              <th className="py-2 pr-4 font-medium">Rol wijzigen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const membership = u.memberships[0];
              return (
                <tr key={u.id} className="border-b border-border">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{u.email}</div>
                    {u.name && <div className="text-muted-foreground">{u.name}</div>}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(u.createdAt)}
                  </td>
                  <td className="py-3 pr-4">
                    {membership ? (
                      <Badge variant="secondary">
                        {membership.tier.key} · {membership.status}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <form action={setUserRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="outline">
                        Opslaan
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !dbError && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Geen leden gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <Link
            href={href({ limit: limit + PAGE })}
            className="inline-block rounded-full border border-input bg-card px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            Toon meer
          </Link>
        </div>
      )}
    </div>
  );
}
