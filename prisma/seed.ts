// Seed the InvestorClub organization, tiers, member tags, onboarding steps and
// an admin user. Run with `npm run db:seed` (after the DB is reachable).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ORG_ID = "investorclub";

async function main() {
  const org = await db.organization.upsert({
    where: { id: ORG_ID },
    update: { name: "InvestorClub" },
    create: { id: ORG_ID, name: "InvestorClub", defaultCurrency: "eur" },
  });

  // NOTE: tier prices are placeholders — Gaetan confirms final pricing later.
  const tiers = [
    { key: "free", name: "Gratis", description: "Account + beperkte community + nieuwsbrief.", priceMonthly: null as number | null, priceYearly: null as number | null, sortOrder: 0 },
    { key: "basis", name: "Basis", description: "Volledige community, live sessies, marktupdates.", priceMonthly: 2900, priceYearly: 29000, sortOrder: 1 },
    { key: "premium", name: "Premium", description: "Alles + prioritaire events, perks en portfolio-koppeling.", priceMonthly: 4900, priceYearly: 49000, sortOrder: 2 },
  ];
  for (const t of tiers) {
    await db.tier.upsert({
      where: { orgId_key: { orgId: org.id, key: t.key } },
      update: { name: t.name, description: t.description, priceMonthly: t.priceMonthly, priceYearly: t.priceYearly, sortOrder: t.sortOrder },
      create: { orgId: org.id, key: t.key, name: t.name, description: t.description, priceMonthly: t.priceMonthly, priceYearly: t.priceYearly, sortOrder: t.sortOrder },
    });
  }

  for (const name of ["vip", "earlybird", "founding-member"]) {
    await db.memberTag.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name },
    });
  }

  const steps = [
    { key: "complete_profile", title: "Vervolledig je profiel", sortOrder: 0, required: true },
    { key: "join_space", title: "Word lid van een space", sortOrder: 1, required: false },
    { key: "first_post", title: "Plaats je eerste bericht", sortOrder: 2, required: false },
  ];
  for (const s of steps) {
    await db.onboardingStep.upsert({
      where: { orgId_key: { orgId: org.id, key: s.key } },
      update: { title: s.title, sortOrder: s.sortOrder, required: s.required },
      create: { orgId: org.id, key: s.key, title: s.title, sortOrder: s.sortOrder, required: s.required },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "gaetanjansseune@gmail.com";
  await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Gaetan", role: "ADMIN" },
  });

  console.log(`Seed complete: org=${org.name}, tiers=${tiers.length}, admin=${adminEmail}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
