import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pauseSubscription, applyWinbackDiscount, cancelSubscription } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Abonnement opzeggen — InvestorClub" };

export default async function CancelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/cancel");

  const membership = await db.membership
    .findFirst({
      where: { userId: session.user.id, status: { in: ["active", "trialing", "past_due"] } },
      include: { tier: true },
      orderBy: { startedAt: "desc" },
    })
    .catch(() => null);

  if (!membership) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Wacht — voor je opzegt</h1>
      <p className="mt-1 text-muted-foreground">
        Je hebt nu <span className="font-medium capitalize text-foreground">{membership.tier.name}</span>.
        Misschien past een van deze opties beter?
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⏸️ Pauzeer in plaats van opzeggen</CardTitle>
            <CardDescription>
              Zet je abonnement tijdelijk stil — je betaalt niets en behoudt je geschiedenis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={pauseSubscription}>
              <Button type="submit" variant="outline">
                Pauzeer abonnement
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">🎁 Blijf met korting</CardTitle>
            <CardDescription>
              We passen een lopende kortingscoupon toe op je abonnement zodat blijven goedkoper wordt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={applyWinbackDiscount}>
              <Button type="submit" variant="brand">
                Pas korting toe
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Toch opzeggen</CardTitle>
            <CardDescription>
              Je behoudt toegang tot het einde van je huidige periode; daarna stopt het.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={cancelSubscription}>
              <Button type="submit" variant="ghost">
                Zeg op aan periode-einde
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Nee, ik behoud mijn abonnement
        </Link>
      </div>
    </div>
  );
}
