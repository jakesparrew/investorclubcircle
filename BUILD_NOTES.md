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
- **Fase 2 Community** ✅ gebouwd (spaces/posts/comments/reacties/polls/gamification/onboarding).
  Nog: poll-aanmaak-UI, profielpagina's, notificatie-UI, moderatie-UI, realtime-feed.
- **Fase 4 Events** ✅ gebouwd (registratie deposit €1/paid/free + wachtlijst + QR-check-in + deposit-refund).
  Nog: event-aanmaak-UI voor hosts/admin (nu via seed), reminders via queue, agenda-sync (iCal/Google).
- **Fase 3 Chat** (DM/groep op Supabase Realtime), **Fase 5 Content-instroom** (livestream/podcast/nieuwsbrief),
  **Fase 6 Cursussen**, **Fase 7 AI-laag** (queue/runner — Inngest vs BullMQ beslissen), **Fase 8 Verdieping**.
- E2E-tests (Playwright) zodra DB live is; nu enkel unit-tests voor `canAccess()`.
- `stripe-sync.ts` verfijnen met live Connect-events (period-velden zitten in API
  `2026-05-27.dahlia` op subscription items).

## 🔒 Adversariële review — opgelost & opvolging

**Opgelost in deze sessie** (2 reviewers, security + correctness):
- Checkout-autorisatie: prijs gevalideerd tegen product (anti price-manipulation), tier `active`-check, org `active`-check.
- Webhook: geen interne foutmeldingen meer in responses (generieke 400/500 + server-log).
- One-time orders: idempotent (`status === paid` guard) + fallback-lookup op payment_intent.
- Membership: tier-resolutie via price-id als metadata ontbreekt; `getAccessContext`/dashboard scopen op active/trialing + `orderBy startedAt desc`.
- Rolwijziging invalideert nu bestaande sessies (`session.deleteMany`).
- Admin-pagina's hebben eigen server-side guard (`requireAdminPage`), niet enkel de layout.
- Veilige `callbackUrl` (alleen same-origin paden) na login.
- Stripe-secret: fail-loud in productie, placeholder enkel in dev/build.

**Nog te doen (opvolging):**
- **Stripe Connect-webhook**: registreer het endpoint als **Connect**-webhook (events "on connected accounts");
  `STRIPE_WEBHOOK_SECRET` = die endpoint-secret. Met direct charges komen subscription/invoice/charge-events
  op het connected account binnen (met `event.account`). Zonder Connect-endpoint synct niets.
- **Rate limiting** op de magic-link-actie (`/login`) — vereist een rate-limit-store (bv. Upstash). Nu nog niet.
- **Customer hergebruik**: nu maakt elke checkout een nieuwe Stripe-customer (`customer_email`); later de
  `stripeCustomerId` per gebruiker bewaren en `customer` hergebruiken (voor billing-portal/proratie).
- **Transitieve vulns** (moderate) in dev/build-tooling (`@hono/node-server` via Prisma Studio, `postcss` via Next) — opvolgen met patch-releases, niet force-fixen.

**Module-review (Fase 2/3/4/6) — opgelost:** bookmark-IDOR dichtgezet (toegangscheck), punten-farming
gestopt (`awardPointsOnce` voor reacties/polls/lessen), academy drip/prerequisites + inschrijving
nu server-side afgedwongen in de acties (niet enkel UI), quiz-grading fail-closed bij vragen zonder
juist antwoord, event-capaciteit via serializable transactie (geen overboeking), check-in enkel voor
bevestigde inschrijvingen + deposit-refund reverseert nu ook de platform-fee, chat toont de recentste 200.

**Module-review — opvolging (later):** waitlist auto-promotie bij vrijgekomen plaats; opruimen van
verlopen `pending`-inschrijvingen (`checkout.session.expired`); prerequisite-cyclus-guard bij cursus-authoring;
unieke sleutel om dubbele 1-op-1-gesprekken bij race te vermijden; paginatie voor chat-threads >200 berichten.

## ▶️ Eerste keer draaien (zodra keys live zijn)

```
npm install
# vul .env.local met echte waarden
npm run db:migrate     # of: npm run db:push
npm run db:seed
npm run dev            # http://localhost:3000
```
