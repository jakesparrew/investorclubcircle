import type { Promotion } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createPromotionAction, togglePromotion } from "@/lib/coupons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requireAdminPage();
  let promotions: Promotion[] = [];
  let connected = false;
  let dbError = false;
  try {
    const org = await db.organization.findFirst();
    connected = Boolean(org?.stripeConnectedAccountId);
    promotions = await db.promotion.findMany({ orderBy: { code: "asc" } });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuwe couponcode</h2>
          <form action={createPromotionAction} className="grid gap-3 sm:grid-cols-2">
            <Input name="code" placeholder="CODE (bv. WELKOM20)" required className="uppercase" />
            <select name="kind" className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="PERCENT">% korting</option>
              <option value="AMOUNT">€ korting (in centen)</option>
              <option value="TRIAL">Gratis proef</option>
              <option value="INTRO">Introprijs</option>
            </select>
            <Input name="value" type="number" placeholder="Waarde (% of centen)" />
            <select name="durationType" className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="ONCE">Eénmalig</option>
              <option value="REPEATING">Herhalend (x maanden)</option>
              <option value="FOREVER">Altijd</option>
            </select>
            <Input name="durationMonths" type="number" placeholder="Aantal maanden (bij herhalend)" />
            <div className="sm:col-span-2">
              <Button type="submit">Coupon aanmaken</Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: voor <strong>“1e maand €1”</strong> maak je een AMOUNT-coupon (eénmalig) met de
            juiste korting, of een INTRO-coupon. Codes zijn meteen invulbaar op de Stripe-checkout
            (<code>allow_promotion_codes</code> staat aan).
          </p>
          {!connected && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              Stripe Connect is nog niet gekoppeld — coupons worden lokaal opgeslagen en automatisch
              naar Stripe gesynct zodra de koppeling actief is.
            </p>
          )}
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Code</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Waarde</th>
              <th className="py-2 pr-4 font-medium">Duur</th>
              <th className="py-2 pr-4 font-medium">Stripe</th>
              <th className="py-2 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-3 pr-4 font-mono font-medium">{p.code}</td>
                <td className="py-3 pr-4">{p.kind}</td>
                <td className="py-3 pr-4">
                  {p.value ?? "—"}
                  {p.kind === "PERCENT" ? "%" : p.kind === "AMOUNT" ? " cent" : ""}
                </td>
                <td className="py-3 pr-4">
                  {p.durationType}
                  {p.durationMonths ? ` (${p.durationMonths}m)` : ""}
                </td>
                <td className="py-3 pr-4">
                  {p.stripeCouponId ? (
                    <Badge variant="success">gesynct</Badge>
                  ) : (
                    <Badge variant="secondary">lokaal</Badge>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <form action={togglePromotion}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                    <Button type="submit" size="sm" variant={p.active ? "outline" : "ghost"}>
                      {p.active ? "Actief" : "Inactief"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {promotions.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nog geen coupons.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
