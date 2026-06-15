# InvestorClub Platform — Volledige Design Spec

> **Status:** ter review
> **Datum:** 2026-06-15
> **Bron-plan:** `Projects/Dca nieuwsbrief/Platform_InvestorClub_projectbeschrijving.md`
> **Scope:** het **volledige platform** (Circle.so-vervanger + events, chat, livestream, podcast, nieuwsbrief, cursussen, AI-laag, portfolio). Eén master-spec, met een **gefaseerde bouwvolgorde** (§14). De bouw gebeurt fase per fase; dit document beschrijft het complete ontwerp zodat geen enkele functie door de mazen valt.

---

## 1. Context & doel

Eén eigen platform waar leden van InvestorClub samenkomen — community, content, live sessies, events en portfolio — in plaats van losse tools (Circle, ticketing, mailing, social). De onderscheidende laag is **automatisering met AI**. Kernprincipe: **bouw de unieke laag zelf, koop het zware werk in** (video, mail, betalingen, transcriptie via externe diensten).

Dit platform vervangt de huidige Circle.so-instance op `app.investorclub.be`. De bestaande marketingsite (`investorclub.be`, Vite/React) blijft een aparte app.

---

## 2. Vastgelegde beslissingen

| Onderwerp | Keuze |
|---|---|
| **Stack** | Next.js (App Router) + TypeScript + Prisma + Tailwind + shadcn/ui |
| **Auth** | Auth.js (e-mail magic link via Resend + Google) |
| **Database/hosting** | Supabase (Postgres + **Realtime** + Storage), EU-regio |
| **Realtime** | Supabase Realtime (feed-updates, chat, notificaties, presence) |
| **Betalingen** | Stripe **Connect** — InvestorClub = connected account, platform pakt application fee (commissie) |
| **Tenancy** | Single-tenant nu + lichte `Organization`-laag voor later (geen multi-tenant-infra nu) |
| **Code-locatie** | Nieuwe, aparte Next.js-app op `app.investorclub.be` |
| **Entitlements** | Stripe-webhooks → lokale `Membership`-tabel; `canAccess()` leest lokaal |
| **Chat / DM** | Zelf bouwen op Postgres + Supabase Realtime |
| **Cursussen** | Eigen cursusmodule (lessen, voortgang, certificaten) |
| **AI-laag + social auto-posten** | **Uitgesteld** naar een latere fase; queue/runner + social-aanpak worden dan vastgelegd |
| **Livestream** | YouTube Live API (publiek), embed in platform |
| **E-mail** | Resend (magic links + nieuwsbrief) |

---

## 3. Gebruikersrollen

- **Bezoeker** — publieke content, kan registreren.
- **Gratis lid** (`role=MEMBER`, tier `free`) — account, beperkte community, nieuwsbrief.
- **Betalend lid** (tier `basis`) — volledige community, live sessies, marktupdates.
- **Premium lid** (tier `premium`) — alles + prioritaire event-toegang, perks, portfolio-koppeling.
- **Expert / host** (`role=EXPERT`) — kan posten, live gaan, events aanmaken, podcast/cursus beheren.
- **Admin** (`role=ADMIN`) — volledige toegang, beheer, betalingen, moderatie, configuratie.

Toegang = **rol** (wat je mag dóén) + **tier** (tot welk niveau) + **productbezit** (eenmalige aankoop), overal via `canAccess()` (§12).

---

## 4. Architectuuroverzicht

- **Frontend + backend:** één Next.js-app (App Router, server actions / route handlers), TypeScript, Tailwind, shadcn/ui.
- **Database:** PostgreSQL (Supabase) via Prisma ORM. Geld als integer in cents.
- **Realtime:** Supabase Realtime-kanalen voor feed, chat, notificaties, live presence.
- **Auth & toegang:** Auth.js + server-side middleware + centrale `canAccess()`. Nooit client-side vertrouwen.
- **Betalingen:** Stripe Connect (direct charges op connected account + application fee). Webhooks → lokale DB.
- **Bestanden:** Supabase Storage (media, bijlagen, cursusvideo's, certificaten).
- **Externe diensten achter adapters:** `PaymentProvider` (Stripe), `MailProvider` (Resend), `VideoProvider` (YouTube), `TranscriptionProvider` (later), `SocialProvider` (later). Zo zijn ze vervangbaar.
- **Achtergrondtaken:** nodig vanaf de content-/AI-fases (RSS-import, mailings, AI-jobs). Queue/runner-keuze (Inngest vs BullMQ+Redis) wordt vastgelegd bij die fase — zie open items §13.
- **Hosting:** Vercel (app) + Supabase (EU). Observability: Sentry.

---

## 5. Datamodel (kern-entiteiten per module)

> Prisma-schema; namen indicatief. Elk gated object draagt een `accessRequirement` (json) dat `canAccess()` leest.

### 5.1 Fundament
- **Organization** *(één rij nu)* — `id, name, stripeConnectedAccountId, stripeAccountStatus, defaultCurrency, createdAt`.
- **User** — `id, name, email (uniek), emailVerified, image, role (MEMBER|EXPERT|ADMIN), suspendedUntil?, createdAt` + Auth.js (`Account`, `Session`, `VerificationToken`).
- **Tier** — `id, orgId, key (free|basis|premium), name, description, priceMonthly, priceYearly, currency, stripeProductId, stripePriceMonthlyId, stripePriceYearlyId, perks(json), sortOrder, active`.
- **Membership** — `id, userId, orgId, tierId, status (active|trialing|past_due|canceled|incomplete), interval (month|year), currentPeriodEnd, cancelAtPeriodEnd, grandfathered(bool), stripeCustomerId, stripeSubscriptionId, startedAt`.
- **Product** — `id, orgId, name, description, active, stripeProductId, images[], sortOrder`.
- **Price** — `id, productId, amount, currency, stripePriceId, active`.
- **Order** — `id, userId, productId, priceId, amount, currency, applicationFeeAmount, status (pending|paid|refunded), stripeCheckoutSessionId, stripePaymentIntentId, createdAt`.
- **Promotion** — `id, orgId, code, kind (PERCENT|AMOUNT|TRIAL|INTRO), value, currency, durationType (ONCE|REPEATING|FOREVER), durationMonths, appliesToTiers[], maxRedemptions, timesRedeemed, expiresAt, stripeCouponId, stripePromotionCodeId, active`.
- **Payment** — `id, userId, kind (subscription|one_time), amount, currency, applicationFeeAmount, stripeInvoiceId, stripePaymentIntentId, status, createdAt`.
- **WebhookEvent** — `id, stripeEventId (uniek), type, processedAt` (idempotentie).
- **AuditLog** — `id, actorId, action, targetType, targetId, metadata(json), createdAt`.

### 5.2 Community
- **Profile** — `userId, bio, headline, links(json), expertise[]`.
- **Badge** — `id, key, name, icon`; **UserBadge** — `userId, badgeId, awardedAt`.
- **SpaceGroup** — `id, orgId, name, sortOrder`.
- **Space** — `id, spaceGroupId, name, slug, description, accessRequirement(json), isPublic, sortOrder`.
- **Post** — `id, spaceId, authorId, title?, content(json rich), status (draft|scheduled|published), pinned, scheduledFor, publishedAt, hiddenAt?, createdAt`.
- **Comment** — `id, postId, authorId, parentId?, content(json), hiddenAt?, createdAt`.
- **Reaction** — `id, targetType (post|comment), targetId, userId, type, createdAt`.
- **Notification** — `id, userId, type, payload(json), readAt?, createdAt`.
- **Report** — `id, reporterId, targetType, targetId, reason, status (open|resolved|dismissed), createdAt` (moderatie).
- Zoeken: Postgres full-text (tsvector-indexen) over posts, comments, users, events — geen aparte entiteit.

### 5.3 Chat / DM
- **Conversation** — `id, type (direct|group), title?, createdById, createdAt`.
- **ConversationMember** — `conversationId, userId, role (member|admin), lastReadAt, joinedAt`.
- **Message** — `id, conversationId, senderId, content(json), attachments(json), createdAt, editedAt?, deletedAt?`. Realtime via Supabase op insert.

### 5.4 Events & ticketbalie
- **Event** — `id, orgId, hostId, title, slug, description, location, startsAt, endsAt, capacity, softCap, accessRequirement(json), depositAmount (bv. €1), nonMemberPrice (bv. €29), status (draft|published|cancelled|completed), recordingUrl?`.
- **Registration** — `id, eventId, userId, type (deposit|paid), paymentStatus, stripePaymentIntentId?, checkinToken (QR), checkedInAt?, waitlistPosition?, refundedAt?, createdAt`.

### 5.5 Content-instroom
- **Livestream** — `id, eventId?, orgId, youtubeBroadcastId, youtubeStreamId, embedUrl, status (scheduled|live|ended), accessRequirement(json), recordingUrl?, startedAt?`. (RTMP-sleutel niet plaintext bewaren.)
- **PodcastFeedSource** — `id, orgId, rssUrl, lastFetchedAt`.
- **PodcastEpisode** — `id, orgId, title, description, audioUrl, externalGuid (uniek), hosts[], guests[], spaceId?, publishedAt`.
- **NewsletterIssue** — `id, orgId, status (draft|scheduled|sent), subject, blocks(json), segment, scheduledFor?, sentAt?`.
- Nieuwsbrief-opt-in op **Profile/User**: `newsletterOptInAt?, segments[]` (double opt-in).

### 5.6 Cursussen (eigen module)
- **Course** — `id, orgId, title, slug, description, coverImage?, accessRequirement(json), status, sortOrder`.
- **CourseModule** — `id, courseId, title, sortOrder`.
- **Lesson** — `id, courseModuleId, title, content(json), videoUrl?, durationSec?, isPreview, sortOrder`.
- **Enrollment** — `id, userId, courseId, enrolledAt, source`.
- **LessonProgress** — `id, userId, lessonId, completedAt`.
- **Certificate** — `id, userId, courseId, serial (uniek), issuedAt, pdfUrl`.

### 5.7 AI-laag *(uitgesteld — schema gesketcht)*
- **AIJob** — `id, type, inputRef, status (queued|running|review|published|failed), output(json), approvedById?, createdAt`.
- **SocialPost** — `id, source, platform, content, status, externalId?, scheduledFor?`.

### 5.8 Verdieping
- **PortfolioLink** — `id, userId, provider (investeren.org), externalAccountId, lastSyncedAt?, status` *(API/SSO te valideren)*.
- Analytics: voornamelijk afgeleide queries + lichte event-logging; geen zwaar datamodel nu.

---

## 6. Fundament — auth, betalingen, gating

### 6.1 Auth & onboarding
- Auth.js + Prisma-adapter op Supabase. Providers: e-mail magic link (Resend) + Google.
- Eerste login → `User` met `role=MEMBER`, geen membership → tier `free`.
- Sessie draagt `userId` + `role`; tier/toegang per request via `canAccess()`.

### 6.2 Betalingen & prijzen
- **Abonnementen:** maandelijks én jaarlijks (jaarkorting). Eén Stripe Price per tier per interval.
- **Eenmalige verkoop:** concrete `Product`/`Price`-catalogus → Checkout `mode=payment` → `Order`.
- **Kortingen/promoties:** % of vast bedrag; duur eenmalig/N maanden/altijd; max. gebruik, vervaldatum, per-tier.
- **1e maand gratis:** Stripe trial (`trial_period_days`).
- **Probeer voor €1:** intro-pricing via Subscription Schedule (fase 1 €1, fase 2 normaal).
- **Commissie:** `application_fee_percent` (abonnementen) / `application_fee_amount` (losse verkoop).

### 6.3 Stripe Connect & webhooks
- Connect-setup: InvestorClub als connected account (aanbevolen **Express**). `stripeConnectedAccountId` + status op `Organization`.
- Checkout als direct charge op het connected account.
- Webhooks: signature-geverifieerd + idempotent (`WebhookEvent`). Verwerkt `checkout.session.completed`, `customer.subscription.*`, `invoice.paid|payment_failed`, `payment_intent.succeeded`, `charge.refunded`, `account.updated` → synct `Membership`/`Payment`/`Order`.

---

## 7. Community

- **Spaces & Space Groups** — onderwerpkanalen (Crypto, Macro, Goud, Fiscaliteit…), elk met `accessRequirement` per tier/rol.
- **Posts & feeds** — rich text, afbeeldingen, video-embed, bijlagen; concept/gepland/gepind.
- **Comments** — genest, **reacties** (likes/emoji), **mentions** (@gebruiker → notificatie).
- **Profielen** — bio, expertise, links, badges, activiteit.
- **Notificaties** — in-app (realtime) + e-mail; per-gebruiker instelbaar. Web push/PWA later.
- **Zoeken** — Postgres full-text over posts, comments, leden, events.
- **Moderatie** — rapporteren, verbergen, verwijderen, gebruiker schorsen (`suspendedUntil`); audit log.

---

## 8. Chat / DM

- 1-op-1 en groepschat, zelf gebouwd op `Conversation`/`ConversationMember`/`Message`.
- Realtime via Supabase Realtime (nieuwe berichten, typing/presence optioneel).
- Ongelezen-teller via `ConversationMember.lastReadAt`.
- Bijlagen via Supabase Storage. Toegang: enkel leden van de conversatie; gating op minimaal tier instelbaar.

---

## 9. Events & ticketbalie

- **Aanmaak** door experts/admin: titel, datum, locatie, capaciteit (soft cap bv. 100), tier-regels.
- **Inschrijving:**
  - Leden: **terugbetaalbare reservatie €1** (no-show-waarborg; terug/credit bij opdagen).
  - Niet-leden: betaald ticket (bv. €29) + upsell naar lidmaatschap.
  - **Wachtlijst** bij volzet; prioriteit voor premium.
- **Check-in** via QR-token op de dag; aanwezigheid → waarborg terugbetalen (Stripe refund).
- **Na afloop:** opname/clips aan het event koppelen, zichtbaar voor leden.
- Later: meerdere locaties + revenue-share per locatie.

---

## 10. Content-instroom

- **Livestream (YouTube):** knop "Ga live" → backend roept YouTube Live API (OAuth op eigen kanaal) → broadcast + stream → RTMP-sleutel + embed-link. Embed in platformpagina (publiek of gated). Bron: OBS/StreamYard. Na afloop: VOD + input voor latere AI-clips.
- **Podcast:** auto-import via RSS (`PodcastFeedSource`) → nieuwe afleveringen verschijnen automatisch. In-platform speler; koppelen aan spaces.
- **Nieuwsbrief:** wekelijkse template met één CTA; segmentatie per tier/interesse; verzending via Resend; double opt-in, uitschrijven, GDPR. (Auto-repost van community-content komt met de AI-laag.)

---

## 11. Cursussen (eigen module)

- **Structuur:** `Course → CourseModule → Lesson` (rich content + video via Supabase Storage/YouTube).
- **Voortgang:** `Enrollment` + `LessonProgress`; voortgangsbalk per cursus.
- **Certificaten:** `Certificate` met serienummer + PDF bij voltooiing.
- **Toegang:** `accessRequirement` per cursus (tier en/of `ownsProduct`). **Cursus → lidmaatschap-brug:** cursuskorting op de club via een `Promotion`.
- **Preview-lessen** (`isPreview`) als gratis teaser.

---

## 12. Toegangscontrole — `canAccess()`

Het hart van het platform. Declaratief, server-side afgedwongen:

```ts
type AccessRequirement = {
  public?: boolean;
  minTier?: 'free' | 'basis' | 'premium';
  roles?: Role[];
  ownsProduct?: string;   // productId
};

canAccess(user, requirement): { ok: boolean; reason?: string };
```

- Tier-volgorde `free < basis < premium`; `minTier:'basis'` = basis óf premium.
- Actuele tier uit `Membership` met status `active|trialing`; anders `free`.
- `ADMIN` overschrijft.
- Afgedwongen in (a) Next.js-middleware en (b) elke server action / route handler vóór data-toegang.
- Eén bron van waarheid: spaces, posts, events, streams, cursussen declareren elk hun `accessRequirement` en leunen hierop.

---

## 13. AI-laag *(uitgestelde fase)*

Volledig ontworpen in het bron-plan; **gebouwd na de kernmodules**. Bij die fase leggen we de queue/runner (Inngest vs BullMQ+Redis) en de social-aanpak (Ayrshare-tussenlaag vs eigen API's) vast.

| Trigger | Stap | Uitvoer |
|---|---|---|
| Nieuwe post | LLM → social-varianten | Concept-posts IG/LinkedIn/X |
| Stream/podcast eindigt | Transcriptie → highlights → clipping | Clips + ondertitels |
| Wekelijks (cron) | LLM bundelt top-content | Conceptnieuwsbrief |
| Lange post/event | LLM-samenvatting | TL;DR |
| Content ingediend | Compliance-check (rendementtaal) | Waarschuwing moderator |

Altijd **human-in-the-loop**: AI maakt concepten, een mens publiceert.

---

## 14. Gefaseerde bouwvolgorde

1. **Fundament** — scaffold + `CLAUDE.md`; datamodel; auth; `canAccess()` + unit-waarheidstabel; Stripe Connect + webhooks + `Membership`; abonnementen (maand/jaar, trial, €1-intro, promoties); producten + losse verkoop; admin-basis; gated "het werkt"-pagina; GDPR-export/verwijdering.
2. **Community** — spaces, posts, comments, reacties, profielen, notificaties (realtime), zoeken, moderatie.
3. **Chat / DM** — conversaties + berichten op Supabase Realtime.
4. **Events & ticketbalie** — €1-waarborg / betaald ticket, wachtlijst, QR-check-in, refund.
5. **Content-instroom** — livestream (YouTube), podcast-import (RSS), nieuwsbrief (Resend).
6. **Cursussen** — eigen module (lessen, voortgang, certificaten, brug naar lidmaatschap).
7. **AI-laag** *(uitgesteld)* — auto-repurposing, clips, samenvattingen, nieuwsbrief-concept, moderatie-assist; queue + social vastleggen.
8. **Verdieping** — portfolio-koppeling (investeren.org), gated streams (Mux), analytics, PWA-push.

Per feature: **done = werkt achter de juiste gating + audit/log + basistest.**

---

## 15. Testen, security & privacy

- **Tests:** unit-waarheidstabel voor `canAccess()` (rol × tier × productbezit × status) — kritiek; integratietests voor Stripe-webhooks (fixtures + idempotentie); E2E voor kernflows (signup → checkout → gated content). Stripe test mode + CLI.
- **Security/GDPR:** webhook-signature + idempotentie; RBAC strikt server-side; geen kaartdata (PCI bij Stripe); data-export/verwijdering per gebruiker; audit-log; EU-regio Supabase; cookie-/consentbeheer; rate limiting op auth; 2FA optioneel voor admins.
- **FSMA/MiCA:** geen rendementbeloftes in publieke content; risicowaarschuwing bij crypto-communicatie; AI-moderatie flagt rendementtaal (vanaf AI-fase).

---

## 16. Open items (vastleggen vóór de betreffende fase)

1. **Connect-accounttype** — Express (aanbevolen) vs Standard. *(Fase 1)*
2. **Commissiepercentage** — application fee % op abonnementen / losse verkoop. *(Fase 1)*
3. **Tier-prijzen** — concrete maand-/jaarprijzen `basis` en `premium` + jaarkorting. *(Fase 1)*
4. **Ledenmigratie** — 370+ bestaande Circle.so-leden migreren (aparte taak vóór go-live).
5. **Grandfathering-regels** — exacte voorwaarden die bestaande leden behouden.
6. **Queue/runner** — Inngest vs BullMQ+Redis. *(Fase 5/7)*
7. **Social-aanpak** — Ayrshare-tussenlaag vs eigen API's. *(Fase 7)*
8. **investeren.org** — API/SSO valideren. *(Fase 8)*
9. **Gated video** — Mux voor exclusieve streams? *(Fase 8)*

---

## 17. Aanpak in Claude Code

- Monorepo met één Next.js-app + `CLAUDE.md` die dit document samenvat (mappenstructuur, naamgeving, human-in-the-loop voor AI, server-side toegangscontrole).
- Module per module volgens §14, elk met eigen Prisma-schema-uitbreiding, route handlers/server actions, UI en tests.
- Centrale `canAccess()` als eerste fundament — alle gating leunt erop.
- Externe diensten achter adapters (`PaymentProvider`, `MailProvider`, `VideoProvider`, later `SocialProvider`/`TranscriptionProvider`).
