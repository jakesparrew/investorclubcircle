import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  let stats = { users: 0, activeMembers: 0, orders: 0, tiers: 0 };
  let dbError = false;
  try {
    const [users, activeMembers, orders, tiers] = await Promise.all([
      db.user.count(),
      db.membership.count({ where: { status: { in: ["active", "trialing"] } } }),
      db.order.count({ where: { status: "paid" } }),
      db.tier.count(),
    ]);
    stats = { users, activeMembers, orders, tiers };
  } catch {
    dbError = true;
  }

  const cards = [
    { label: "Gebruikers", value: stats.users },
    { label: "Actieve leden", value: stats.activeMembers },
    { label: "Betaalde orders", value: stats.orders },
    { label: "Tiers", value: stats.tiers },
  ];

  return (
    <div>
      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — cijfers verschijnen zodra de verbinding live is.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle className="text-3xl">{c.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-500">{c.label}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
