import type { Tier } from "@prisma/client";
import { db } from "@/lib/db";
import { startSubscriptionCheckout } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lidmaatschap — InvestorClub" };

export default async function PricingPage() {
  let tiers: Tier[] = [];
  let dbError = false;
  try {
    tiers = await db.tier.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold">Kies je lidmaatschap</h1>
        <p className="mt-2 text-neutral-600">Maandelijks opzegbaar. Jaarabonnement met korting.</p>
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-center text-sm text-amber-700">
          De database is nog niet gekoppeld — prijzen verschijnen zodra de verbinding live is.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="capitalize">{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <div className="text-2xl font-bold">
                {tier.priceMonthly != null
                  ? `${formatMoney(tier.priceMonthly, tier.currency)} / maand`
                  : "Gratis"}
              </div>
              <form action={startSubscriptionCheckout.bind(null, tier.id, "month")}>
                <Button
                  type="submit"
                  variant={tier.key === "free" ? "outline" : "brand"}
                  className="w-full"
                  disabled={tier.key === "free"}
                >
                  {tier.key === "free" ? "Standaard" : "Word lid"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {!dbError && tiers.length === 0 && (
          <p className="col-span-full text-center text-sm text-neutral-500">
            Nog geen lidmaatschappen geconfigureerd. Voer de seed uit.
          </p>
        )}
      </div>
    </div>
  );
}
