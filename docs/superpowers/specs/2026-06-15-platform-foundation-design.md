# InvestorClub Platform — Fundament (sub-project 1) — Design Spec

> **Status:** ter review
> **Datum:** 2026-06-15
> **Bron-plan:** `Projects/Dca nieuwsbrief/Platform_InvestorClub_projectbeschrijving.md`
> **Scope van deze spec:** enkel het **Fundament** — auth, rollen, tiers, betalingen (Stripe Connect), producten, promoties en de centrale `canAccess()`-gating. Community, events, livestream, podcast, nieuwsbrief, AI-laag en portfolio zijn aparte latere sub-projecten.

---

## 1. Context & doel

Het volledige plan beschrijft een eigen community-platform "à la Circle.so" voor InvestorClub, met community, events/ticketing, livestream, podcast, nieuwsbrief en een AI-laag. Dat is te groot voor één spec, dus het is opgedeeld in onafhankelijke sub-projecten die elk hun eigen spec → plan → bouw-cyclus krijgen.

Dit document specificeert **sub-project 1: het Fundament** — de laag waar alle andere modules op leunen. Zonder auth, rollen, tiers, betalingen en gating kan geen enkele andere module bestaan, en dit levert meteen terugkerend abonnementsinkomen op.

**Definition of done voor het Fundament:** een bezoeker kan registreren → een betaald abonnement (maand/jaar) nemen via Stripe, of een los product kopen → waarbij geld naar InvestorClub gaat en een commissie (application fee) naar het platform → en daarmee toegang krijgt tot een tier-gated testpagina. Een admin kan tiers, prijzen, producten, promoties en leden beheren. Alle toegang wordt server-side afgedwongen, met tests.

---

## 2. Vastgelegde beslissingen

| Onderwerp | Keuze | Reden |
|---|---|---|
| **Stack** | Next.js (App Router) + TypeScript + Prisma + Tailwind + shadcn/ui | Eén taal front+back, sluit aan op bestaande React-kennis en de plan-stack |
| **Auth** | Auth.js (e-mail magic link via Resend + Google) | Standaard, sessies + OAuth, Prisma-adapter |
| **Database/hosting** | Supabase (Postgres + realtime + storage), EU-regio | Bundelt Postgres + realtime (later nodig) + media-opslag; GDPR EU-hosting |
| **Betalingen** | **Stripe Connect** | Platform pakt application fee (commissie); ondersteunt BE/NL recurring via SEPA-mandaat uit iDEAL/Bancontact |
| **Tenancy** | Single-tenant nu (InvestorClub = enige connected account) + lichte `Organization`-laag | Commissie werkt vanaf dag één; multi-tenant blijft een latere uitbreiding, geen herbouw (YAGNI) |
| **Code-locatie** | Nieuwe, aparte Next.js-app op `app.investorclub.be` | Schone scheiding van de bestaande Vite-marketingsite; vervangt Circle.so op die subdomein |
| **Entitlements** | Stripe-webhooks → lokale `Membership`-tabel; `canAccess()` leest lokaal | Snel, testbaar, niet afhankelijk van live Stripe-calls. Stripe blijft bron van waarheid voor betaalstatus |
| **E-mail** | Resend | Magic links nu; transactioneel + nieuwsbrief later |

---

## 3. Scope

### In scope (Fundament)
- Authenticatie (e-mail magic link + Google) en gebruikersaccounts.
- Rollen (capability): `MEMBER`, `EXPERT`, `ADMIN`; onauthenticated = bezoeker.
- Tiers (toegangsniveau): `free`, `basis`, `premium` — configureerbaar, met prijzen.
- Abonnementen: maandelijks én jaarlijks (met jaarkorting).
- Eenmalige betalingen + een concrete **producten/prijzen-catalogus** voor losse verkoop.
- Promoties: kortingen (% / vast bedrag), 1e-maand-gratis (trial), "probeer voor €1" (intro pricing).
- Stripe Connect met application fee (commissie) op zowel abonnementen als losse verkoop.
- `Membership` gesynct via Stripe-webhooks.
- Centrale `canAccess(user, resource)` — het gating-primitief.
- Minimaal admin-dashboard.
- Basis GDPR/security (audit log, webhook-signature, RBAC server-side, EU-hosting).
- Eén kale tier-gated "het werkt"-pagina als bewijs.

### Expliciet buiten scope (latere sub-projecten)
Community/spaces/posts/comments/DM, events & ticketbalie, livestream, podcast, nieuwsbrief-verzending, AI-laag, portfolio-koppeling, cursussen, analytics-dashboards, native app. De `canAccess()`-laag en de betaal-/producten-laag worden zo ontworpen dat deze modules er later op aansluiten.

---

## 4. Architectuuroverzicht

- **Frontend + backend:** één Next.js-app (App Router, server actions / route handlers), TypeScript, Tailwind, shadcn/ui.
- **Database:** PostgreSQL (Supabase) via Prisma ORM.
- **Auth & toegang:** Auth.js + server-side middleware en een centrale `canAccess()` die rol + tier + productbezit controleert. Nooit client-side vertrouwen.
- **Betalingen:** Stripe Connect (direct charges op het connected account + application fee). Webhooks syncen status naar de lokale DB.
- **Externe diensten achter adapters:** `PaymentProvider` (Stripe) en `MailProvider` (Resend) achter een interface, zodat ze later vervangbaar zijn.
- **Bestanden:** Supabase Storage (media voor producten/profielen).
- **Hosting:** Vercel (app) + Supabase (Postgres/realtime/storage), EU-regio.
- **Config:** secrets in env; feature flags licht voorbereid.

---

## 5. Datamodel (kern-entiteiten)

> Prisma-schema; namen indicatief. Geld in kleinste eenheid (cents) als integer.

- **Organization** *(nu één rij: InvestorClub)* — `id, name, stripeConnectedAccountId, stripeAccountStatus, defaultCurrency, createdAt`. De lichte multi-tenant-haak.
- **User** — `id, name, email (uniek), emailVerified, image, role (MEMBER|EXPERT|ADMIN), createdAt` + Auth.js-tabellen (`Account`, `Session`, `VerificationToken`).
- **Tier** — `id, orgId, key (free|basis|premium), name, description, priceMonthly, priceYearly, currency, stripeProductId, stripePriceMonthlyId, stripePriceYearlyId, perks(json), sortOrder, active`.
- **Membership** — `id, userId, orgId, tierId, status (active|trialing|past_due|canceled|incomplete), interval (month|year), currentPeriodEnd, cancelAtPeriodEnd, grandfathered(bool), stripeCustomerId, stripeSubscriptionId, startedAt`. (Eén actieve membership per user per org.)
- **Product** — `id, orgId, name, description, active, stripeProductId, images[], sortOrder, createdAt`.
- **Price** — `id, productId, amount, currency, stripePriceId, active`. (Een product kan meerdere prijzen hebben.)
- **Order** — `id, userId, productId, priceId, amount, currency, applicationFeeAmount, status (pending|paid|refunded), stripeCheckoutSessionId, stripePaymentIntentId, createdAt`. Registreert eigendom; `canAccess` kan gaten op productbezit.
- **Promotion** — `id, orgId, code, kind (PERCENT|AMOUNT|TRIAL|INTRO), value, currency, durationType (ONCE|REPEATING|FOREVER), durationMonths, appliesToTiers[], maxRedemptions, timesRedeemed, expiresAt, stripeCouponId, stripePromotionCodeId, active`.
- **Payment** — `id, userId, kind (subscription|one_time), amount, currency, applicationFeeAmount, stripeInvoiceId, stripePaymentIntentId, status, createdAt`. Logt beide betaalsoorten + commissie.
- **WebhookEvent** — `id, stripeEventId (uniek), type, processedAt`. Voor idempotentie.
- **AuditLog** — `id, actorId, action, targetType, targetId, metadata(json), createdAt`.

Kernonderscheid: **rol = wat je mag dóén**, **tier = tot welk niveau je toegang hebt**. `canAccess()` combineert rol, tier én productbezit.

---

## 6. Auth & onboarding

- Auth.js met Prisma-adapter op Supabase Postgres.
- Providers: **e-mail magic link** (verzonden via Resend) + **Google OAuth**.
- Eerste login → `User` aangemaakt met `role=MEMBER`, geen membership → effectief tier `free`.
- Sessie draagt `userId` + `role`. Tier/toegang wordt per request bepaald via `canAccess()` (leest actuele `Membership`), niet vastgepind in de sessie.
- Uitloggen, sessieverloop standaard via Auth.js.

---

## 7. Betalingen & prijzen

### 7.1 Betaalmodi
- **Abonnementen** (tier-gebonden): maandelijks én jaarlijks. Eén Stripe Price per tier per interval. Jaarabonnement met korting.
- **Eenmalige betalingen:** concrete `Product` + `Price` catalogus, gekocht via Stripe Checkout in `payment`-mode → `Order`.

### 7.2 Kortingen & introaanbiedingen
Alles via Stripe Coupons / Promotion Codes / Subscription Schedules, lokaal gespiegeld in `Promotion`:
- **Kortingen op abonnees:** % of vast bedrag; duur eenmalig / N maanden / altijd; optioneel max. gebruik, vervaldatum, beperkt tot bepaalde tiers.
- **1e maand gratis:** Stripe **trial** (`trial_period_days`, bv. 30) — kaart vastgelegd, geen heffing eerste periode, automatische omzetting daarna.
- **Probeer voor €1:** intro-pricing via **Subscription Schedule** (fase 1 = €1 voor één periode, fase 2 = normale prijs).

### 7.3 Commissie (application fee)
- Abonnementen: `application_fee_percent` op de subscription (direct charge op het connected account).
- Losse verkoop: `application_fee_amount` op de PaymentIntent/Checkout.
- Commissiepercentage is configureerbaar (open item §12).

---

## 8. Stripe Connect, flows & webhooks

### 8.1 Connect-setup (eenmalig)
- Platform-account (developer) + InvestorClub als **connected account** (aanbevolen **Express** — platform houdt UX/uitbetaling in handen; bevestigbaar, zie §12).
- Onboarding via Stripe-gehoste flow; `stripeConnectedAccountId` + status op `Organization`.

### 8.2 Checkout-flows
- **Abonnement:** Stripe Checkout `mode=subscription` als direct charge op het connected account, met `application_fee_percent`, optioneel `trial_period_days`, promotiecode of Subscription Schedule (€1-intro). Customer op het connected account.
- **Los product:** Checkout `mode=payment` met `application_fee_amount` → bij succes `Order` = paid.

### 8.3 Webhooks
- Eén endpoint, **signature-geverifieerd**, **idempotent** via `WebhookEvent.stripeEventId`.
- Verwerkte events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, `payment_intent.succeeded`, `charge.refunded`, `account.updated`.
- Effecten: `Membership` aanmaken/bijwerken (status, periode, interval, cancelAtPeriodEnd), `Payment` loggen, `Order` afronden/terugbetalen, Connect-onboardingstatus bijwerken.

---

## 9. Toegangscontrole — `canAccess()`

Het hart van het hele platform. Declaratief, server-side afgedwongen:

```ts
type AccessRequirement = {
  public?: boolean;
  minTier?: 'free' | 'basis' | 'premium';
  roles?: Role[];        // bv. moet EXPERT of ADMIN zijn
  ownsProduct?: string;  // productId — eenmalige aankoop-entitlement
};

canAccess(user, requirement): { ok: boolean; reason?: string };
```

- Tier-volgorde: `free < basis < premium`. `minTier:'basis'` = basis óf premium.
- Actuele tier afgeleid uit `Membership` met status `active|trialing`; anders `free`.
- `ADMIN` overschrijft (toegang tot alles).
- Afgedwongen in (a) Next.js-middleware voor routes en (b) per server action / route handler vóór data-toegang. Nooit enkel client-side.
- Eén bron van waarheid — alle latere modules (spaces, posts, events, streams) declareren hun eigen `AccessRequirement` en leunen op deze functie.

---

## 10. Admin (minimaal)

Beheerschermen, allemaal achter `role=ADMIN`:
- **Tiers & prijzen** — CRUD + sync naar Stripe (product/prices).
- **Producten & prijzen** — CRUD voor losse verkoop + sync naar Stripe.
- **Promoties** — CRUD + sync naar Stripe coupons/promotion codes.
- **Leden** — lijst met tier, status, `grandfathered`-toggle, rol toekennen.
- **Audit-log** — overzicht van admin-acties en betalingen.
- **Organisatie/Connect** — onboardingstatus + (her)onboarding-link.

---

## 11. Testen, security & privacy

### 11.1 Tests
- **Unit (kritiek):** waarheidstabel voor `canAccess()` — alle combinaties van rol × tier × productbezit × membership-status.
- **Integratie:** webhook-handlers met Stripe-fixtures/`stripe-mock`; idempotentie (zelfde event tweemaal → één effect); membership-statusovergangen.
- **E2E (licht):** signup → Stripe testmode-checkout → toegang tot gated pagina; admin maakt tier aan.
- Stripe **test mode** + Stripe CLI voor lokale webhook-forwarding.
- Definition of done per feature: werkt achter de juiste gating + audit/log + basistest.

### 11.2 Security & GDPR
- Webhook-signature-verificatie + idempotentie.
- RBAC strikt server-side; `canAccess()` op data-/actieniveau, niet alleen UI.
- Geen kaartdata zelf opslaan (PCI bij Stripe).
- GDPR: data-export en -verwijdering per gebruiker; audit-log voor admin-acties en betalingen; EU-regio op Supabase; cookie-/consentbeheer.
- Rate limiting op auth-endpoints; 2FA optioneel voor admins (later).
- Secrets in env (Stripe keys, Auth secret, Resend key, DB-url).

---

## 12. Open items (vastleggen tijdens/vlak na review)

1. **Connect-accounttype** — Express (aanbevolen) vs Standard. Bepaalt onboarding-UX en dashboard-eigenaarschap.
2. **Commissiepercentage** — exacte application fee (% op abonnementen, % of vast op losse verkoop).
3. **Tier-prijzen** — concrete maand-/jaarprijzen voor `basis` en `premium` (en jaarkorting).
4. **Ledenmigratie** — de 370+ bestaande Circle.so-leden migreren naar dit platform: aparte taak; valt buiten deze spec maar moet ingepland worden vóór go-live.
5. **Grandfathering-regels** — exacte voorwaarden die bestaande leden behouden tot verlenging.

---

## 13. Bouwvolgorde (vooruitblik, wordt het implementatieplan)

1. Project-scaffold (Next.js + TS + Prisma + Tailwind/shadcn + Auth.js) + `CLAUDE.md` met conventies.
2. Datamodel + migraties (Prisma op Supabase).
3. Auth (magic link + Google) + `User`/rollen.
4. `canAccess()` + unit-waarheidstabel (eerst, want alles leunt erop).
5. Stripe Connect-adapter + onboarding + webhooks (idempotent) + `Membership`-sync.
6. Abonnement-checkout (maand/jaar) + trial + €1-intro + promoties.
7. Producten/prijzen + losse-verkoop-checkout + `Order`.
8. Admin-dashboard (tiers, producten, promoties, leden, audit).
9. Gated "het werkt"-pagina + E2E.
10. GDPR-export/verwijdering + hardening.

> Externe diensten achter adapters (`PaymentProvider`, `MailProvider`). Centrale `canAccess()` als eerste fundament. Per feature: done = werkt achter juiste gating + audit/log + basistest.
