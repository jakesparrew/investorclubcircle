# Build Notes — InvestorClub Platform

Status van de autonome bouw + wat er nog nodig is. Bijgewerkt 2026-06-15.

## ✅ Fase 1 (Fundament) — gebouwd

- Next.js 16 + TS + Tailwind v4 scaffold, alias `@/*`.
- Prisma 7 schema voor het volledige Fundament (auth, org, tiers, membership, products,
  prices, bundles, offers, orders, gifts, promotions, affiliate/referral, payments,
  dunning, member tags, onboarding, webhook-idempotency, audit log). Client gegenereerd.
  Init-migratie-SQL: `prisma/migrations/0000_init/migration.sql`.
- **`canAccess()`** (`src/lib/access.ts`) + 14 unit-tests (groen).
- Auth.js v5: magic link (Resend) + Google, database sessions, `role` op sessie.
  Route handler + `src/proxy.ts` gating voor `/dashboard` en `/admin`.
- Stripe Connect (Standard, 5% fee): client + onboarding-helpers + subscription/one-time
  checkout + idempotente webhook-handler (`/api/stripe/webhook`) die Membership/Payment/
  Order synct.
- UI: login, home, pricing, dashboard (+ premium-gated demo), admin (overzicht/leden/tiers).
- Seed (`prisma/seed.ts`): org InvestorClub, 3 tiers, member tags, onboarding steps, admin user.

## 🔑 Wat ik van jou nodig heb (om live te zetten)

1. **Supabase DB-connectie** — DB-wachtwoord + region voor `DATABASE_URL`/`DIRECT_URL`
   in `.env.local` (nu placeholders). Daarna: `npm run db:migrate && npm run db:seed`.
2. **Echte API-keys** in `.env.local` (nu dummy's): `AUTH_SECRET` (`npx auth secret`),
   `AUTH_GOOGLE_ID/SECRET` (Google OAuth consent screen + redirect
   `https://app.investorclub.be/api/auth/callback/google`), `AUTH_RESEND_KEY` + geverifieerd
   Resend-domein voor `EMAIL_FROM`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
   (Connect-webhook) + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. **Stripe Connect onboarding** — InvestorClub als Standard connected account koppelen
   (account-link flow), dan `Organization.stripeConnectedAccountId` invullen.
4. **Tier-prijzen** bevestigen (seed gebruikt placeholders €29/€49 p/m).
5. **GitHub** — remote `https://github.com/jakesparrew/investorclubcircle` (leeg). Ik push de eerste commit.

## 📝 Beslissingen die ik autonoom nam (pas gerust aan)

- Prisma **legacy `prisma-client-js`** generator (import `@prisma/client`) i.p.v. de nieuwe
  `prisma-client` (die een custom output-pad eist) — meest compatibel met de auth-adapter.
- Tier-prijzen placeholder: basis €29/mnd (€290/jr), premium €49/mnd (€490/jr).
- Google-font (Geist) verwijderd → system fonts, voor build-robuustheid.
- DB-rakende pagina's vangen verbindingsfouten op (tonen "nog niet gekoppeld") zodat de
  app rendert zonder live DB.
- Admin-user e-mail: `gaetanjansseune@gmail.com` (override met `SEED_ADMIN_EMAIL`).

## ⏭️ Taken voor later (per fase uit de spec)

- **Dunning-mails**: webhook zet `past_due` + `DunningAttempt`; nog koppelen aan Resend-mail (TODO in `stripe-sync.ts`).
- **Intro €1 / Subscription Schedule**: helper + UI nog te bouwen (nu enkel trial + promo).
- **Affiliate-uitbetaling**: beloning nu free_month/credit; cash-payout via Stripe transfers later.
- **Gift memberships**: schema + flow aanwezig; verzilver-UI nog bouwen.
- **Fase 2 Community** (spaces/posts/chat/gamification/onboarding-UI), **Fase 3 Chat**,
  **Fase 4 Events** (introduceert queue/runner — Inngest vs BullMQ beslissen),
  **Fase 5 Content-instroom**, **Fase 6 Cursussen**, **Fase 7 AI-laag**, **Fase 8 Verdieping**.
- E2E-tests (Playwright) zodra DB live is; nu enkel unit-tests voor `canAccess()`.
- `stripe-sync.ts` verfijnen met live Connect-events (period-velden zitten in API
  `2026-05-27.dahlia` op subscription items).

## ▶️ Eerste keer draaien (zodra keys live zijn)

```
npm install
# vul .env.local met echte waarden
npm run db:migrate     # of: npm run db:push
npm run db:seed
npm run dev            # http://localhost:3000
```
