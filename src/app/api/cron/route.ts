import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendEmail, emailLayout } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // disabled until a secret is configured
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

/** True if we already created a notification of this type for the user recently. */
async function notifiedRecently(userId: string, type: string, hours = 20): Promise<boolean> {
  const since = new Date(Date.now() - hours * HOUR);
  return Boolean(
    await db.notification.findFirst({ where: { userId, type, createdAt: { gte: since } } }),
  );
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Forbidden", { status: 403 });

  const now = new Date();
  const result = { eventReminders: 0, dunning: 0, streakAtRisk: 0 };

  // ── 1. Event reminders: events starting within 24h, once per event ──────────
  const upcoming = await db.event
    .findMany({
      where: { status: "published", startsAt: { gte: now, lte: new Date(now.getTime() + DAY) } },
      include: {
        registrations: {
          where: { status: { in: ["confirmed", "pending"] } },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    })
    .catch(() => []);

  for (const ev of upcoming) {
    const already = await db.eventReminder.findFirst({
      where: { eventId: ev.id, offsetMinutes: 1440, sentAt: { not: null } },
    });
    if (already) continue;

    const link = `${APP_URL}/events/${ev.slug}`;
    for (const reg of ev.registrations) {
      await notify(reg.userId, "event_reminder", { link: `/events/${ev.slug}`, title: ev.title });
      if (reg.user.email) {
        await sendEmail({
          to: reg.user.email,
          subject: `Herinnering: ${ev.title}`,
          html: emailLayout(
            `Tot snel bij ${ev.title}`,
            `Je event start binnenkort${ev.location ? ` (${ev.location})` : ""}.`,
            { label: "Bekijk event", url: link },
          ),
        });
      }
    }
    await db.eventReminder.create({
      data: {
        eventId: ev.id,
        offsetMinutes: 1440,
        channel: "email",
        scheduledFor: ev.startsAt,
        sentAt: now,
      },
    });
    result.eventReminders++;
  }

  // ── 2. Dunning: past_due members with a pending attempt (deduped to once/day) ─
  const pastDue = await db.membership
    .findMany({
      where: { status: "past_due" },
      include: { user: { select: { id: true, email: true } } },
    })
    .catch(() => []);

  for (const m of pastDue) {
    const pending = await db.dunningAttempt.findFirst({
      where: { membershipId: m.id, outcome: "pending" },
    });
    if (!pending) continue;
    if (await notifiedRecently(m.userId, "payment_failed")) continue;

    await notify(m.userId, "payment_failed", { link: "/dashboard", title: "Betaling mislukt" });
    if (m.user.email) {
      await sendEmail({
        to: m.user.email,
        subject: "Je betaling is mislukt — herstel je toegang",
        html: emailLayout(
          "Betaling mislukt",
          "We konden je laatste betaling niet verwerken. Werk je betaalmethode bij om je lidmaatschap te behouden.",
          { label: "Herstel betaling", url: `${APP_URL}/dashboard` },
        ),
      });
    }
    result.dunning++;
  }

  // ── 3. Streak-at-risk: logged in yesterday, not today (deduped) ──────────────
  const yesterday = ymd(new Date(now.getTime() - DAY));
  const today = ymd(now);
  const [yRows, tRows] = await Promise.all([
    db.pointsLedger
      .findMany({ where: { reason: "daily_login", sourceId: yesterday }, select: { userId: true }, distinct: ["userId"] })
      .catch(() => []),
    db.pointsLedger
      .findMany({ where: { reason: "daily_login", sourceId: today }, select: { userId: true }, distinct: ["userId"] })
      .catch(() => []),
  ]);
  const todaySet = new Set(tRows.map((r) => r.userId));
  for (const r of yRows) {
    if (todaySet.has(r.userId)) continue;
    if (await notifiedRecently(r.userId, "streak_at_risk")) continue;
    await notify(r.userId, "streak_at_risk", { link: "/dashboard" });
    result.streakAtRisk++;
  }

  return Response.json({ ok: true, ranAt: now.toISOString(), ...result });
}
