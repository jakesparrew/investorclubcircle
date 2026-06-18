import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateAffiliateCode } from "@/lib/referral";
import { optionalEnv } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Uitnodigen — InvestorClub" };

export default async function ReferralPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/referral");

  let affiliate: { code: string } | null = null;
  let conversions = 0;
  let dbError = false;
  try {
    affiliate = await db.affiliate.findUnique({
      where: { userId: session.user.id },
      select: { id: true, code: true },
    });
    if (affiliate) {
      conversions = await db.referralConversion.count({
        where: { affiliate: { userId: session.user.id } },
      });
    }
  } catch {
    dbError = true;
  }

  const appUrl = optionalEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  const link = affiliate ? `${appUrl}/r/${affiliate.code}` : null;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Nodig vrienden uit</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Deel je persoonlijke link. Nieuwe leden die zich via jou inschrijven worden aan jou
        gekoppeld.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          {affiliate && link ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Jouw link</div>
                <div className="mt-1 break-all rounded-md border border-border bg-muted p-2 text-sm">
                  {link}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aangebracht</span>
                <span className="font-medium">{conversions} leden</span>
              </div>
            </div>
          ) : (
            <form action={getOrCreateAffiliateCode}>
              <p className="mb-3 text-sm text-muted-foreground">Genereer je persoonlijke uitnodigingslink.</p>
              <Button type="submit">Maak mijn link</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
