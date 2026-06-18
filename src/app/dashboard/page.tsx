import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Gem,
  Flame,
  Award,
  GraduationCap,
  Plus,
  Settings,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard";
import { DailyCheckin } from "@/components/DailyCheckin";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { toggleNewsletterOptIn } from "@/lib/newsletter";
import { AreaChart, Sparkline, Donut } from "@/components/charts/Charts";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

function Kpi({
  label,
  icon,
  iconClass,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`grid size-8 place-items-center rounded-lg ${iconClass}`}>{icon}</span>
      </div>
      {children}
    </div>
  );
}

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs font-medium text-muted-foreground">—</span>;
  const up = pct > 0;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        up ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
      }`}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let d: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  try {
    d = await getDashboardData(session.user.id, session.user.role);
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <DailyCheckin />
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — het dashboard verschijnt zodra de verbinding live is.
        </p>
      </div>
    );
  }

  const firstName = session.user.name?.split(" ")[0] ?? "daar";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <DailyCheckin />

      {/* Greeting */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Hoi, {firstName} 👋</h1>
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
              {d.tierName}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.pointsThisWeek > 0 ? (
              <>
                Deze week al <span className="font-semibold text-primary">{d.pointsThisWeek} punten</span>{" "}
                verdiend. Goed bezig!
              </>
            ) : (
              <>Welkom terug — plaats iets of volg een les om punten te verdienen.</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/profile/edit">
              <Settings className="size-4" /> Instellingen
            </Link>
          </Button>
          <Button asChild variant="brand" size="sm">
            <Link href="/community">
              <Plus className="size-4" /> Nieuwe post
            </Link>
          </Button>
        </div>
      </header>

      {/* KPI row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Mijn punten" icon={<Gem className="size-4" />} iconClass="bg-accent text-primary">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold tracking-tight">{d.points.toLocaleString("nl-BE")}</div>
              <div className="mt-1.5">
                <Delta pct={d.pointsWeekDeltaPct} />
              </div>
            </div>
            <div className="h-9 w-16 text-primary">
              <Sparkline data={d.pointsSeries} />
            </div>
          </div>
        </Kpi>

        <Kpi
          label="Streak"
          icon={<Flame className="size-4" />}
          iconClass="bg-orange-100 text-orange-500 dark:bg-orange-500/15"
        >
          <div className="flex items-end justify-between gap-2">
            <div className="text-2xl font-bold tracking-tight">
              {d.streak} <span className="text-base font-semibold text-muted-foreground">dgn</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground">🔥 reeks</span>
          </div>
        </Kpi>

        <Kpi label="Lidmaatschap" icon={<Award className="size-4" />} iconClass="bg-chart-5/15 text-chart-5">
          <div className="flex items-center gap-3">
            <Donut
              value={d.tierKey === "free" ? 0 : 100}
              size={44}
              label={d.tierKey === "free" ? "" : "✓"}
              className="text-primary"
            />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold capitalize">{d.tierName}</div>
              <div className="text-xs text-muted-foreground">{d.membershipStatus}</div>
            </div>
          </div>
        </Kpi>

        <Kpi
          label="Cursusvoortgang"
          icon={<GraduationCap className="size-4" />}
          iconClass="bg-chart-4/15 text-chart-4"
        >
          <div className="flex items-center gap-3">
            <Donut value={d.coursePct} size={44} label={`${d.coursePct}%`} className="text-chart-4" />
            <div className="text-sm text-muted-foreground">
              {d.courses.length} {d.courses.length === 1 ? "cursus" : "cursussen"}
            </div>
          </div>
        </Kpi>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left */}
        <div className="space-y-6 lg:col-span-2">
          {/* Activity chart */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-semibold">Activiteit</h2>
                <p className="text-xs text-muted-foreground">Puntenverloop afgelopen 30 dagen</p>
              </div>
              <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                30D
              </span>
            </div>
            <div className="p-6">
              <div className="h-48 w-full">
                <AreaChart data={d.pointsSeries} id="dash-points" className="text-primary" />
              </div>
              <div className="mt-6 rounded-xl border border-primary/15 bg-accent/50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Level
                    </div>
                    <div className="truncate text-sm font-bold">
                      {d.level.name}
                      {d.level.nextName && (
                        <span className="font-medium text-muted-foreground"> → {d.level.nextName}</span>
                      )}
                    </div>
                  </div>
                  {d.level.nextName && (
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Nog te gaan
                      </div>
                      <div className="text-sm font-bold text-primary">{d.level.toNext} punten</div>
                    </div>
                  )}
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${d.level.pct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">Recente activiteit</h2>
              <Link href="/community" className="text-xs font-semibold text-primary hover:underline">
                Naar feed
              </Link>
            </div>
            <div className="divide-y divide-border">
              {d.activity.map((a) => (
                <Link
                  key={a.id}
                  href={`/community/${a.spaceSlug}/${a.id}`}
                  className="flex gap-3 px-6 py-4 hover:bg-muted/40"
                >
                  <Avatar src={a.authorImage} name={a.authorName} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm">
                        <span className="font-semibold">{a.authorName}</span>
                        <span className="text-muted-foreground"> in </span>
                        <span className="font-medium text-primary">{a.spaceName}</span>
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                      {a.title ?? a.content}
                    </p>
                  </div>
                </Link>
              ))}
              {d.activity.length === 0 && (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Nog geen activiteit in je spaces.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Events */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Aankomende events</h2>
              <CalendarDays className="size-4 text-muted-foreground" />
            </div>
            <div className="p-2">
              {d.events.map((e) => {
                const day = new Intl.DateTimeFormat("nl-BE", { day: "numeric" }).format(e.startsAt);
                const month = new Intl.DateTimeFormat("nl-BE", { month: "short" })
                  .format(e.startsAt)
                  .replace(".", "");
                const time = new Intl.DateTimeFormat("nl-BE", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(e.startsAt);
                return (
                  <Link
                    key={e.id}
                    href={`/events/${e.slug}`}
                    className="group flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50"
                  >
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground">{month}</span>
                      <span className="text-lg font-bold leading-none text-primary">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold group-hover:text-primary">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {time}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                );
              })}
              {d.events.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Geen geplande events.</p>
              )}
            </div>
          </div>

          {/* Course progress */}
          {d.courses.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Leren</h2>
                <Link href="/academy" className="text-xs font-semibold text-primary hover:underline">
                  Bekijk alles
                </Link>
              </div>
              <div className="space-y-4">
                {d.courses.slice(0, 4).map((c) => (
                  <Link key={c.id} href={`/academy/${c.slug}`} className="block">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{c.title}</span>
                      <span
                        className={`shrink-0 font-semibold ${c.pct >= 100 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {c.pct >= 100 ? "Compleet" : `${c.pct}%`}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Leaderboard</h2>
              <Trophy className="size-4 text-muted-foreground" />
            </div>
            <div className="divide-y divide-border">
              {d.leaderboard.slice(0, 3).map((r, i) => {
                const me = r.userId === session.user.id;
                return (
                  <div
                    key={r.userId}
                    className={`flex items-center gap-3 px-5 py-3 ${me ? "bg-accent/50" : ""}`}
                  >
                    <span className="w-5 text-center text-base">{MEDALS[i]}</span>
                    <Avatar src={r.image} name={r.name} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {me ? "Jij" : (r.name ?? r.email)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">{r.points} pt</span>
                  </div>
                );
              })}
              {d.myRank && d.myRank > 3 && (
                <div className="flex items-center gap-3 border-t-2 border-primary/20 bg-accent/40 px-5 py-3">
                  <span className="w-5 text-center text-xs font-bold text-primary">{d.myRank}</span>
                  <Avatar src={session.user.image} name={session.user.name} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">Jij</span>
                  <span className="shrink-0 text-sm font-semibold text-primary">{d.points} pt</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary: onboarding + newsletter */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {d.orgId && (
          <div className="lg:col-span-2">
            <OnboardingChecklist userId={session.user.id} orgId={d.orgId} />
          </div>
        )}
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div className="min-w-0">
              <div className="font-medium">Nieuwsbrief</div>
              <div className="text-sm text-muted-foreground">Wekelijkse update in je inbox.</div>
            </div>
            <form action={toggleNewsletterOptIn}>
              <Button type="submit" variant="outline" size="sm">
                Beheer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
