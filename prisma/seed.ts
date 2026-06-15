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

  // ─── Events (Fase 4) ──────────────────────────────────────────────────────
  await db.event.upsert({
    where: { slug: "investorclub-live-avond" },
    update: {},
    create: {
      slug: "investorclub-live-avond",
      orgId: org.id,
      hostId: admin.id,
      title: "InvestorClub Live Avond",
      description: "Een avond met experts over de crypto- en macro-vooruitzichten voor 2026.",
      location: "Gent",
      startsAt: new Date("2026-09-15T18:00:00.000Z"),
      endsAt: new Date("2026-09-15T21:00:00.000Z"),
      capacity: 100,
      softCap: 100,
      isPublic: true,
      depositAmount: 100, // €1 terugbetaalbare waarborg voor leden
      nonMemberPrice: 2900, // €29 ticket voor niet-leden
      status: "published",
      reminderOffsets: [1440, 60],
    },
  });

  // ─── Academy (Fase 6) ─────────────────────────────────────────────────────
  const course = await db.course.upsert({
    where: { slug: "crypto-basis" },
    update: { status: "published" },
    create: {
      id: "course_crypto_basis",
      orgId: org.id,
      title: "Crypto Basis",
      slug: "crypto-basis",
      description: "Leer de fundamenten van crypto-investeren in een paar korte lessen.",
      isPublic: false,
      minTier: "free",
      status: "published",
      sortOrder: 0,
    },
  });
  const mod = await db.courseModule.upsert({
    where: { id: "mod_intro" },
    update: { title: "Introductie" },
    create: { id: "mod_intro", courseId: course.id, title: "Introductie", sortOrder: 0 },
  });
  const lessons = [
    { id: "les_what", title: "Wat is crypto?", content: "Crypto is digitaal geld op een gedecentraliseerd netwerk (blockchain). In deze les leer je de kernbegrippen.", isPreview: true, sortOrder: 0 },
    { id: "les_wallets", title: "Wallets & veiligheid", content: "Een wallet bewaart je sleutels, niet je munten. We bespreken hot vs cold wallets en veilige bewaring.", isPreview: false, sortOrder: 1 },
    { id: "les_strategy", title: "Een eenvoudige strategie", content: "Dollar-cost averaging (DCA): periodiek een vast bedrag investeren om timing-risico te spreiden.", isPreview: false, sortOrder: 2 },
  ];
  for (const l of lessons) {
    await db.lesson.upsert({
      where: { id: l.id },
      update: { title: l.title, content: l.content, isPreview: l.isPreview, sortOrder: l.sortOrder, courseModuleId: mod.id },
      create: { id: l.id, courseModuleId: mod.id, title: l.title, content: l.content, isPreview: l.isPreview, sortOrder: l.sortOrder },
    });
  }
  const quiz = await db.quiz.upsert({
    where: { lessonId: "les_wallets" },
    update: { title: "Kennischeck: wallets", passPercent: 50 },
    create: { id: "quiz_wallets", lessonId: "les_wallets", title: "Kennischeck: wallets", passPercent: 50 },
  });
  const q1 = await db.question.upsert({
    where: { id: "q_wallet_1" },
    update: { prompt: "Wat bewaart een crypto-wallet?" },
    create: { id: "q_wallet_1", quizId: quiz.id, type: "single", prompt: "Wat bewaart een crypto-wallet?", sortOrder: 0 },
  });
  const answers = [
    { id: "a_keys", text: "Je private keys", isCorrect: true, sortOrder: 0 },
    { id: "a_coins", text: "De munten zelf", isCorrect: false, sortOrder: 1 },
    { id: "a_pw", text: "Je e-mailwachtwoord", isCorrect: false, sortOrder: 2 },
  ];
  for (const a of answers) {
    await db.answer.upsert({
      where: { id: a.id },
      update: { text: a.text, isCorrect: a.isCorrect, sortOrder: a.sortOrder },
      create: { id: a.id, questionId: q1.id, text: a.text, isCorrect: a.isCorrect, sortOrder: a.sortOrder },
    });
  }

  console.log(
    `Seed complete: org=${org.name}, tiers=${tiers.length}, spaces=${spaces.length}, levels=${levels.length}, course=${course.slug}, admin=${adminEmail}`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
