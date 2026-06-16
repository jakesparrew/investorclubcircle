import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { getUserTotalPoints, getLevelForPoints, getLoginStreak } from "@/lib/points";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { DailyCheckin } from "@/components/DailyCheckin";
import { toggleNewsletterOptIn } from "@/lib/newsletter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let tierLabel = "free";
  let statusLabel = "geen abonnement";
  let premiumOk = false;
  let orgId: string | null = null;
  let points = 0;
  let levelName = "—";
  let streak = 0;
  let newsletterOptIn = false;
  try {
    const org = await db.organization.findFirst();
    orgId = org?.id ?? null;
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { newsletterOptIn: true },
    });
    newsletterOptIn = u?.newsletterOptIn ?? false;
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id, status: { in: ["active", "trialing"] } },
      include: { tier: true },
      orderBy: { startedAt: "desc" },
    });
    if (membership) {
      tierLabel = membership.tier.key;
      statusLabel = membership.status;
    }
    const ctx = await getAccessContext(session.user.id, session.user.role);
    premiumOk = canAccess(ctx, { minTier: "premium" }).ok;
    points = await getUserTotalPoints(session.user.id);
    streak = await getLoginStreak(session.user.id);
    if (orgId) {
      const level = await getLevelForPoints(orgId, points);
      if (level) levelName = level.name;
    }
  } catch {
    // Database not connected yet — show defaults.
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DailyCheckin />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welkom{session.user.name ? `, ${session.user.name}` : ""}</h1>
          <p className="text-sm text-neutral-500">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            Uitloggen
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Je account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Rol</span>
              <Badge variant="secondary">{session.user.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Tier</span>
              <Badge>{tierLabel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Abonnement</span>
              <span className="font-medium">{statusLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Punten</span>
              <span className="font-medium">
                {points} · {levelName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Streak</span>
              <span className="font-medium">
                {streak} dag{streak === 1 ? "" : "en"} 🔥
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Premium-zone</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="mb-3 text-neutral-600">
              Voorbeeld van tier-gating via <code>canAccess()</code>.
            </p>
            {premiumOk ? (
              <Badge variant="success">Toegang verleend</Badge>
            ) : (
              <Badge variant="warning">Premium vereist</Badge>
            )}
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/premium">
                <Button size="sm" variant="outline">
                  Open premium-pagina
                </Button>
              </Link>
              {!premiumOk && (
                <Link href="/pricing">
                  <Button size="sm">Upgrade</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/bookmarks" className="text-neutral-700 underline">
          ★ Bewaarde posts
        </Link>
        <Link href={`/members/${session.user.id}`} className="text-neutral-700 underline">
          Mijn profiel
        </Link>
        <Link href="/referral" className="text-neutral-700 underline">
          Uitnodigen
        </Link>
        <Link href="/portfolio" className="text-neutral-700 underline">
          Portfolio
        </Link>
      </div>

      <div className="mt-6">
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <div className="font-medium">Nieuwsbrief</div>
              <div className="text-sm text-neutral-500">
                {newsletterOptIn ? "Je ontvangt de nieuwsbrief." : "Je bent niet ingeschreven."}
              </div>
            </div>
            <form action={toggleNewsletterOptIn}>
              <Button type="submit" variant={newsletterOptIn ? "outline" : "default"} size="sm">
                {newsletterOptIn ? "Uitschrijven" : "Inschrijven"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {orgId && (
        <div className="mt-6">
          <OnboardingChecklist userId={session.user.id} orgId={orgId} />
        </div>
      )}

      {session.user.role === "ADMIN" && (
        <div className="mt-6">
          <Link href="/admin" className="text-sm font-medium text-neutral-900 underline">
            → Adminpaneel
          </Link>
        </div>
      )}
    </div>
  );
}
