// Idempotent demo data: spreads ~4 weeks of points activity across the admin
// (and a few demo members) so the dashboard charts/leaderboard look alive.
// Safe to re-run — entries are keyed by (userId, reason, sourceId).
//   npx tsx prisma/demo-activity.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 86_400_000;

async function ensurePoints(
  userId: string,
  points: number,
  sourceId: string,
  createdAt: Date,
  reason = "demo_activity",
) {
  const existing = await db.pointsLedger.findFirst({ where: { userId, reason, sourceId } });
  if (existing) return false;
  await db.pointsLedger.create({
    data: { userId, points, reason, sourceType: "demo", sourceId, createdAt },
  });
  return true;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "gaetanjansseune@gmail.com";
  const admin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`No admin user ${adminEmail} — run npm run db:seed first.`);
    process.exit(1);
  }

  const demoEmails = [
    "sven@demo.investorclub.be",
    "lara@demo.investorclub.be",
    "tom@demo.investorclub.be",
    "nora@demo.investorclub.be",
    "yusuf@demo.investorclub.be",
  ];
  const demos = await db.user.findMany({ where: { email: { in: demoEmails } } });

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let created = 0;

  // Admin: an undulating-but-upward 28-day activity curve.
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY);
    const idx = 27 - i;
    const pts = Math.max(
      1,
      6 + Math.round(6 * Math.sin(idx / 2.3)) + (idx % 4 === 0 ? 9 : 0) + (idx % 7 === 0 ? 5 : 0),
    );
    const key = `demo-${date.toISOString().slice(0, 10)}`;
    if (await ensurePoints(admin.id, pts, key, date)) created++;
  }

  // Demo members: a lighter sprinkle so the leaderboard has spread.
  for (let m = 0; m < demos.length; m++) {
    const user = demos[m];
    for (let i = 25; i >= 0; i -= 1 + (m % 3)) {
      const date = new Date(today.getTime() - i * DAY);
      const pts = Math.max(1, 4 + ((i + m * 3) % 11));
      const key = `demo-${date.toISOString().slice(0, 10)}`;
      if (await ensurePoints(user.id, pts, key, date)) created++;
    }
  }

  const total = await db.pointsLedger.aggregate({
    where: { userId: admin.id },
    _sum: { points: true },
  });
  console.log(`Demo activity ensured. New ledger rows: ${created}. Admin total points: ${total._sum.points}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
