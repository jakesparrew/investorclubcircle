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
- **Fase 2 Community** ✅ (spaces/posts/comments/reacties/polls/gamification/onboarding). Nog: poll-aanmaak-UI, profielpagina's, notificatie-UI, moderatie-UI, realtime-feed.
- **Fase 3 Chat** ✅ (1-op-1 DM + auto-refresh). Nog: groepschat, echte Supabase Realtime, ongelezen-badges.
- **Fase 4 Events** ✅ (deposit €1/paid/free + wachtlijst + check-in + refund). Nog: event-aanmaak-UI voor hosts, reminders via queue, agenda-sync, waitlist auto-promotie.
- **Fase 5 Content** ✅ (livestream-embed, nieuwsbrief, analytics). Nog: podcast RSS-import (parser), "Ga live" via YouTube API, agenda.
- **Fase 6 Academy** ✅ (cursussen/drip/quizzes/voortgang/certificaten). Nog: cursus-/quiz-aanmaak-UI (nu via seed), certificaat-PDF.
- **Fase 7 AI-laag** ✅ (social-repurposing via Claude). Nog: ANTHROPIC_API_KEY zetten; samenvattingen/clips/nieuwsbrief-auto-concept; queue voor batch.
- **Fase 8 Verdieping** ⏳ portfolio (investeren.org API), gated streams (Mux), PWA-push — wacht op externe API's/keuzes.
- E2E-tests (Playwright) zodra alle keys live zijn; nu unit-tests voor `canAccess()`.
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

## 🔜 Backlog — "Go Live" automatisering (genoteerd 2026-06-19)

**Nu:** `/admin/streams` is handmatig — host plakt een YouTube-embed-URL, platform toont die
met tier-toegang (`Livestream.embedUrl`, status scheduled/live/ended). Geen auto-aanmaak.

**Gevraagd:** "Go Live" laat het platform de live volledig zelf aanmaken (link + alles) via API.

### Optie A — YouTube Live via API (gekozen richting, later bouwen)
Platform maakt de uitzending automatisch aan via de YouTube Live Streaming API:
1. Eenmalige OAuth-koppeling van het YouTube-kanaal ("Koppel YouTube") → nieuw `YouTubeAccount`-model
   (access/refresh token veilig opslaan).
2. Bij "Go Live": `liveBroadcasts.insert` (uitzending) + `liveStreams.insert` (RTMP-ingest + streamsleutel)
   + `liveBroadcasts.bind`; sla embed/kijklink automatisch op in `Livestream` (geen plakken meer).
3. Status pollen (`liveBroadcasts.list`) → auto `live`/`ended`; na afloop opname-URL ophalen.
- Randvoorwaarden: kanaal met live streaming aan; Google Cloud OAuth-app; gratis quota (ruim genoeg).
- Nodig van Gaetan: Google OAuth client id/secret + kanaal koppelen. (Past bij "API-gedoe later".)

### ⚠️ Open punt — OBS-drempel voor hosts (Gaetan's terechte zorg)
De API maakt de live aan, maar de host moet het **camerabeeld** nog naar YouTube duwen via RTMP.
Dat betekent **OBS (PC) of YouTube-app (telefoon)** — een reële drempel voor niet-technische hosts.
Mogelijke verzachtingen / alternatieven om vóór de bouw te beslissen:
- **YouTube-telefoonapp**: live vanaf gsm (maar vereist 50+ abonnees, en beeld loopt niet via onze API).
- **Browser-studio's (Streamyard / Restream / Riverside)**: vriendelijker dan OBS, streamen naar YouTube
  via RTMP — maar nog steeds een externe tool.
- **Echt nul-drempel (geen tool, camera recht uit de browser)** = NIET via YouTube. Dan nodig:
  **LiveKit / Daily / Mux / Cloudflare Stream** (WebRTC-infra, betaald per minuut/kijker). 1 knop →
  camera live op het platform, inclusief opname. Mooiste UX voor hosts, maar kosten + andere koppeling.

**Beslissing voor later:** gratis + groot bereik maar host-OBS (YouTube-API) **vs** betaald + nul host-drempel
(LiveKit/Daily). Leden/kijkers merken in beide gevallen niks — die kijken gewoon op het platform.

### Verfijning (2026-06-19) — browser-streaming vs YouTube
- **YouTube browser-webcam (YouTube Studio "Go Live → Webcam")** kan zonder OBS, MAAR dan maakt
  YouTube het event aan, niet onze API. Een API-aangemaakte YouTube-broadcast kan je NIET met een
  browser-webcam voeden (browser kan geen RTMP pushen). Dus "platform maakt event" + "browser-stream"
  combineren niet via YouTube alleen.
- **Wel samen** = een tussendienst die WebRTC/WHIP-browseringest aanneemt: **Cloudflare Stream Live,
  Mux, LiveKit, Daily.co**. Die geven: browser-streaming zonder OBS + API om het event te maken +
  speler embedden op platform + opname + optioneel simulcast naar YouTube. → past exact bij Gaetan's wens.
- **Vimeo Live**: heeft API (event aanmaken kan), maar betaald abonnement (Advanced ~€65/mnd); zelfde
  categorie als bovenstaande, duurder instap. Niet eenvoudiger.
- **Aanrader voor "browser + platform regelt event": Cloudflare Stream of Daily.co** (usage-based).

### ✅ Beslissing (2026-06-19): LiveKit self-hosted op een VPS
Gekozen richting voor "Go Live": **LiveKit self-host** (browser-streaming zonder OBS, controle, lage vaste kost).

**Cruciaal ontwerp-detail — kijkers via HLS, niet rauwe WebRTC:**
- LiveKit is een WebRTC SFU. Host → veel kijkers puur over WebRTC = de VPS relayt media naar ELKE kijker
  → bandbreedte schaalt lineair (prima voor tientallen, duur voor honderden).
- Schaal-vriendelijk patroon: host streamt WebRTC → **LiveKit Egress → HLS → CDN** voor kijkers. VPS-last
  blijft laag, kijkers schalen goedkoop. Egress doet ook opname (naar S3) en kan simulcasten naar YouTube.

**VPS / infra-stack (later op te zetten):**
- Klein VPS (~€5–10/mnd, 2–4 vCPU, 4–8 GB) voor `livekit-server` + `redis`. Egress (HLS/opname) wil
  2–4 vCPU extra (transcoding).
- Domein + **TLS verplicht** (WebRTC vereist secure context). UDP-poortrange open + TCP/TLS fallback; LiveKit
  heeft ingebouwde TURN.
- Containers: livekit-server + redis (basis); + egress + (optioneel) ingress voor RTMP-in (OBS) / RTMP-out (YouTube).
- Opname → object storage (S3 / Supabase Storage).
- **Ops-realiteit:** jij bewaakt updates/uptime/TLS. Lager-effort start = **LiveKit Cloud free tier** (zelfde
  app-code), later naar self-host als kost groeit.

**Platform-kant om te bouwen (zelfde of het nu Cloud of self-host is):**
- `LiveSession`-model (room, host, status, tier-gating, recordingUrl).
- Server-side token-endpoint (LiveKit access tokens; host = publish, kijker = subscribe-only).
- Host "Go Live"-pagina (browser camera via `@livekit/components-react`).
- Kijkerspagina: HLS-player (schaal) of WebRTC-subscribe (klein), achter `canAccess()`.
- Webhook van LiveKit → status live/ended + opname-URL opslaan.
