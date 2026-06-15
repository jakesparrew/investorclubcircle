import type { Tier } from "@prisma/client";
import { db } from "@/lib/db";
import { toggleTierActiveAction } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { requireAdminPage } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function AdminTiersPage() {
  await requireAdminPage();
  let tiers: Tier[] = [];
  let dbError = false;
  try {
    tiers = await db.tier.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
        Database nog niet gekoppeld — tiers verschijnen zodra de verbinding live is.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tiers.map((tier) => (
        <div
          key={tier.id}
          className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold capitalize">{tier.name}</span>
              <Badge variant={tier.active ? "success" : "secondary"}>
                {tier.active ? "actief" : "inactief"}
              </Badge>
            </div>
            <div className="text-sm text-neutral-500">
              {tier.priceMonthly != null
                ? `${formatMoney(tier.priceMonthly, tier.currency)}/maand`
                : "Gratis"}
              {tier.priceYearly != null && ` · ${formatMoney(tier.priceYearly, tier.currency)}/jaar`}
            </div>
          </div>
          <form action={toggleTierActiveAction}>
            <input type="hidden" name="tierId" value={tier.id} />
            <Button type="submit" size="sm" variant={tier.active ? "outline" : "default"}>
              {tier.active ? "Deactiveer" : "Activeer"}
            </Button>
          </form>
        </div>
      ))}
      {tiers.length === 0 && (
        <p className="text-sm text-neutral-400">Nog geen tiers. Voer de seed uit.</p>
      )}
    </div>
  );
}
