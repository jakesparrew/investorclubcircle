import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  let cards: { label: string; value: string | number }[] = [];
  let dbError = false;
  try {
    const active = await db.membership.findMany({
      where: { status: { in: ["active", "trialing"] } },
      include: { tier: true },
    });
    let mrr = 0;
    let basis = 0;
    let premium = 0;
    for (const m of active) {
      if (m.tier.key === "basis") basis++;
      else if (m.tier.key === "premium") premium++;
      if (m.interval === "year" && m.tier.priceYearly) mrr += Math.round(m.tier.priceYearly / 12);
      else if (m.tier.priceMonthly) mrr += m.tier.priceMonthly;
    }
    const [users, posts, pointsAgg, enrollments, certificates, eventRegs] = await Promise.all([
      db.user.count(),
      db.post.count(),
      db.pointsLedger.aggregate({ _sum: { points: true } }),
      db.enrollment.count(),
      db.certificate.count(),
      db.registration.count({ where: { status: "confirmed" } }),
    ]);
    cards = [
      { label: "Gebruikers", value: users },
      { label: "Actieve leden", value: active.length },
      { label: "MRR (schatting)", value: formatMoney(mrr) },
      { label: "Basis / Premium", value: `${basis} / ${premium}` },
      { label: "Community-posts", value: posts },
      { label: "Punten totaal", value: pointsAgg._sum.points ?? 0 },
      { label: "Cursus-inschrijvingen", value: enrollments },
      { label: "Certificaten", value: certificates },
      { label: "Event-inschrijvingen", value: eventRegs },
    ];
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader>
            <CardTitle className="text-2xl">{c.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{c.label}</CardContent>
        </Card>
      ))}
    </div>
  );
}
