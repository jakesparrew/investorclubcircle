import { requireAdminPage } from "@/lib/guards";
import { getRevenueMetrics, type RevenueMetrics } from "@/lib/revenue";
import { Sparkline } from "@/components/charts/Charts";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default async function AdminRevenuePage() {
  await requireAdminPage();

  let m: RevenueMetrics | null = null;
  try {
    m = await getRevenueMetrics();
  } catch {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
    );
  }

  const maxTierMrr = Math.max(1, ...m.byTier.map((t) => t.mrrCents));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="MRR" value={formatMoney(m.mrrCents)} hint={`ARR ${formatMoney(m.arrCents)}`} />
        <Kpi
          label="Actieve leden"
          value={`${m.activeCount}`}
          hint={`${m.trialingCount} in proef · ${m.pastDueCount} betaalprobleem`}
        />
        <Kpi label="ARPU" value={formatMoney(m.arpuCents)} hint="per actief lid / maand" />
        <Kpi
          label="Churn"
          value={`${(m.churnRate * 100).toFixed(1)}%`}
          hint={`${m.churningCount} zegt op`}
        />
        <Kpi label="LTV" value={formatMoney(m.ltvCents)} hint="ARPU ÷ churn" />
        <Kpi label="Totaal leden" value={`${m.totalMembers}`} hint="alle accounts" />
        <Kpi
          label="Cursus-voltooiing"
          value={m.enrollments ? `${(m.completionRate * 100).toFixed(0)}%` : "—"}
          hint={m.enrollments ? `${m.certificates}/${m.enrollments} inschrijvingen` : "nog geen inschrijvingen"}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nieuwe leden (8 wk)
          </div>
          <div className="mt-3 h-10 w-full text-primary">
            <Sparkline data={m.signupsWeekly} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {m.signupsWeekly.reduce((s, n) => s + n, 0)} in 8 weken
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Omzet per tier</h2>
        <div className="flex flex-col gap-3">
          {m.byTier.map((t) => (
            <div key={t.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm font-medium capitalize">{t.name}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((t.mrrCents / maxTierMrr) * 100)}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-sm text-muted-foreground">
                {formatMoney(t.mrrCents)} · {t.count}
              </span>
            </div>
          ))}
          {m.byTier.length === 0 && (
            <p className="text-sm text-muted-foreground">Nog geen betalende leden.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        MRR is berekend uit actieve/proef-abonnementen × tierprijs (jaarprijs ÷ 12). Churn = leden met
        opzegging op periode-einde. Cijfers worden live uit de database berekend.
      </p>
    </div>
  );
}
