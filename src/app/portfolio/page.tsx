import Link from "next/link";
import { redirect } from "next/navigation";
import type { PortfolioLink } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { getMockPortfolio, holdingValueCents, portfolioTotalCents } from "@/lib/portfolio";
import { linkPortfolio, unlinkPortfolio } from "@/lib/portfolio-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portfolio — InvestorClub" };

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/portfolio");

  let allowed = false;
  let link: PortfolioLink | null = null;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    allowed = canAccess(ctx, { minTier: "premium" }).ok;
    if (allowed) link = await db.portfolioLink.findUnique({ where: { userId: session.user.id } });
  } catch {
    // DB not connected — treat as not allowed below.
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Premium-perk</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>Portfolio-koppeling is voorbehouden aan premium-leden.</p>
            <Link href="/pricing">
              <Button className="w-full">Bekijk lidmaatschappen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const holdings = link ? getMockPortfolio(session.user.id) : [];
  const total = portfolioTotalCents(holdings);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Portfolio</h1>
      <p className="mb-6 text-sm text-muted-foreground">Je gekoppelde investeren.org-portfolio.</p>

      {!link ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              Koppel je investeren.org-account om je portfolio hier te zien.
            </p>
            <form action={linkPortfolio}>
              <Button type="submit" variant="brand">
                Koppel investeren.org
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
            ⚠️ Fictieve voorbeelddata — wordt vervangen door je echte investeren.org-portfolio zodra
            de API gekoppeld is.
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{formatMoney(total)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Totale waarde</CardContent>
          </Card>

          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {holdings.map((h) => (
              <div key={h.symbol} className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {h.name} <Badge variant="secondary">{h.symbol}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.amount} {h.symbol} · {formatMoney(h.priceCents)}
                  </div>
                </div>
                <span className="shrink-0 font-semibold">{formatMoney(holdingValueCents(h))}</span>
              </div>
            ))}
          </div>

          <form action={unlinkPortfolio}>
            <Button type="submit" size="sm" variant="ghost">
              Ontkoppel
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
