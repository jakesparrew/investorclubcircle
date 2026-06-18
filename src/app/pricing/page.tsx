import Link from "next/link";
import type { Tier } from "@prisma/client";
import { db } from "@/lib/db";
import { startSubscriptionCheckout } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lidmaatschap — InvestorClub" };

const RECOMMENDED = "premium";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const sp = await searchParams;
  const yearly = sp.billing === "yearly";
  const interval: "month" | "year" = yearly ? "year" : "month";

  let tiers: Tier[] = [];
  let dbError = false;
  try {
    tiers = await db.tier.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Kies je lidmaatschap</h1>
        <p className="mt-2 text-muted-foreground">Maandelijks opzegbaar. Jaarabonnement met korting.</p>
      </div>

      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          <Link
            href="/pricing?billing=monthly"
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              !yearly ? "bg-brand font-medium text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Maandelijks
          </Link>
          <Link
            href="/pricing?billing=yearly"
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              yearly ? "bg-brand font-medium text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Jaarlijks
            <span className="ml-1 text-xs opacity-80">−2 maanden</span>
          </Link>
        </div>
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-center text-sm text-amber-700">
          De database is nog niet gekoppeld — prijzen verschijnen zodra de verbinding live is.
        </p>
      )}

      <div className="grid items-start gap-4 sm:grid-cols-3">
        {tiers.map((tier) => {
          const recommended = tier.key === RECOMMENDED;
          const isFree = tier.key === "free";
          const price = yearly ? tier.priceYearly : tier.priceMonthly;
          const perks = Array.isArray(tier.perks) ? (tier.perks as string[]) : [];
          const savings =
            yearly && tier.priceMonthly && tier.priceYearly
              ? Math.round((1 - tier.priceYearly / (tier.priceMonthly * 12)) * 100)
              : 0;
          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${recommended ? "border-brand shadow-md ring-1 ring-brand" : ""}`}
            >
              {recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-brand">
                    Meest gekozen
                  </Badge>
                </span>
              )}
              <CardHeader>
                <CardTitle className="capitalize">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold">
                    {price != null
                      ? `${formatMoney(price, tier.currency)} ${yearly ? "/ jaar" : "/ maand"}`
                      : isFree
                        ? "Gratis"
                        : "—"}
                  </div>
                  {savings > 0 && (
                    <div className="mt-1 text-xs font-medium text-emerald-600">
                      Bespaar {savings}% t.o.v. maandelijks
                    </div>
                  )}
                  {perks.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted-foreground">
                      {perks.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-brand">✓</span>
                          <span className="min-w-0">{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <form action={startSubscriptionCheckout.bind(null, tier.id, interval)}>
                  <Button
                    type="submit"
                    variant={isFree ? "outline" : "brand"}
                    className="w-full"
                    disabled={isFree || (price == null && !isFree)}
                  >
                    {isFree ? "Standaard" : "Word lid"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
        {!dbError && tiers.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Nog geen lidmaatschappen geconfigureerd. Voer de seed uit.
          </p>
        )}
      </div>
    </div>
  );
}
