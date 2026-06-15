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
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: { email: adminEmail, name: "Gaetan", role: "ADMIN" },
  });

  // ─── Community (Fase 2) ───────────────────────────────────────────────────
  const groups = [
    { id: "sg_algemeen", name: "Algemeen", sortOrder: 0 },
    { id: "sg_markten", name: "Markten", sortOrder: 1 },
  ];
  for (const g of groups) {
    await db.spaceGroup.upsert({
      where: { id: g.id },
      update: { name: g.name, sortOrder: g.sortOrder, orgId: org.id },
      create: { id: g.id, orgId: org.id, name: g.name, sortOrder: g.sortOrder },
    });
  }

  const spaces = [
    { id: "sp_aankondigingen", spaceGroupId: "sg_algemeen", name: "Aankondigingen", slug: "aankondigingen", description: "Nieuws van het team.", isPublic: true, minTier: null as string | null, sortOrder: 0 },
    { id: "sp_introducties", spaceGroupId: "sg_algemeen", name: "Introducties", slug: "introducties", description: "Stel jezelf voor.", isPublic: false, minTier: "free", sortOrder: 1 },
    { id: "sp_crypto", spaceGroupId: "sg_markten", name: "Crypto", slug: "crypto", description: "Bitcoin, altcoins, on-chain.", isPublic: false, minTier: "basis", sortOrder: 0 },
    { id: "sp_premium", spaceGroupId: "sg_markten", name: "Premium analyses", slug: "premium-analyses", description: "Diepgaande analyses voor premium-leden.", isPublic: false, minTier: "premium", sortOrder: 1 },
  ];
  for (const s of spaces) {
    await db.space.upsert({
      where: { id: s.id },
      update: { name: s.name, slug: s.slug, description: s.description, isPublic: s.isPublic, minTier: s.minTier, sortOrder: s.sortOrder, spaceGroupId: s.spaceGroupId },
      create: s,
    });
  }

  await db.post.upsert({
    where: { id: "post_welcome" },
    update: {},
    create: {
      id: "post_welcome",
      spaceId: "sp_aankondigingen",
      authorId: admin.id,
      title: "Welkom bij InvestorClub 👋",
      content: "Welkom op het nieuwe platform! Stel jezelf voor in Introducties en verdien je eerste punten.",
      pinned: true,
    },
  });

  // ─── Gamification (Fase 2) ────────────────────────────────────────────────
  const levels = [
    { rank: 1, name: "Starter", minPoints: 0 },
    { rank: 2, name: "Actief lid", minPoints: 50 },
    { rank: 3, name: "Bijdrager", minPoints: 200 },
    { rank: 4, name: "Expert", minPoints: 500 },
    { rank: 5, name: "Legende", minPoints: 1000 },
  ];
  for (const l of levels) {
    await db.level.upsert({
      where: { orgId_rank: { orgId: org.id, rank: l.rank } },
      update: { name: l.name, minPoints: l.minPoints },
      create: { orgId: org.id, rank: l.rank, name: l.name, minPoints: l.minPoints },
    });
  }

  const badges = [
    { key: "founding", name: "Founding member", icon: "🌟" },
    { key: "first_post", name: "Eerste post", icon: "✍️" },
  ];
  for (const b of badges) {
    await db.badge.upsert({ where: { key: b.key }, update: { name: b.name, icon: b.icon }, create: b });
  }

  console.log(
    `Seed complete: org=${org.name}, tiers=${tiers.length}, spaces=${spaces.length}, levels=${levels.length}, admin=${adminEmail}`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
