import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { setUserRoleAction } from "@/lib/admin";
import { requireAdminPage } from "@/lib/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ROLES = ["MEMBER", "EXPERT", "ADMIN"] as const;

type MemberRow = Prisma.UserGetPayload<{ include: { memberships: { include: { tier: true } } } }>;

export default async function AdminMembersPage() {
  await requireAdminPage();
  let users: MemberRow[] = [];
  let dbError = false;
  try {
    users = await db.user.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { tier: true } } },
    });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
        Database nog niet gekoppeld — leden verschijnen zodra de verbinding live is.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="py-2 pr-4 font-medium">E-mail</th>
            <th className="py-2 pr-4 font-medium">Lidmaatschap</th>
            <th className="py-2 pr-4 font-medium">Rol wijzigen</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const membership = u.memberships[0];
            return (
              <tr key={u.id} className="border-b border-neutral-100">
                <td className="py-3 pr-4">
                  <div className="font-medium">{u.email}</div>
                  {u.name && <div className="text-neutral-400">{u.name}</div>}
                </td>
                <td className="py-3 pr-4">
                  {membership ? (
                    <Badge variant="secondary">
                      {membership.tier.key} · {membership.status}
                    </Badge>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <form action={setUserRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
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
          {users.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-neutral-400">
                Nog geen gebruikers.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
