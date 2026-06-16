# Mock / placeholder data — replace before go-live

Elke plek waar fictieve of placeholder-data in het systeem zit, zodat we het later
één voor één door echte data/integraties kunnen vervangen.

## 🔴 Fictieve data (echt "nep", duidelijk gemarkeerd)

| # | Locatie | Wat | Vervangen door |
|---|---------|-----|----------------|
| 1 | `src/lib/portfolio.ts` (`getMockPortfolio`, `MOCK_PRICES`) | Fictieve crypto-holdings (BTC/ETH/SOL/ADA/LINK) + **vaste** prijzen, deterministisch per user | Echte **investeren.org API**-client (op `PortfolioLink.externalAccountId`) + live prijzen |
| 2 | `src/lib/portfolio-actions.ts` (`linkPortfolio`) | "Koppelen" doet alsof: zet enkel een `PortfolioLink` met `externalAccountId = mock-…` | Echte OAuth/SSO-koppeling met investeren.org |
| 3 | `/portfolio` pagina | Toont een **gele "fictieve data"-banner** boven de holdings | Banner weghalen zodra data echt is |

## 🟡 Placeholder-data (plausibel, maar nog te bevestigen/vervangen)

| # | Locatie | Wat | Actie |
|---|---------|-----|-------|
| 4 | `prisma/seed.ts` — tiers | Tier-prijzen: basis €29/mnd (€290/jr), premium €49/mnd (€490/jr) | Bevestig de echte prijzen |
| 5 | `prisma/seed.ts` — community | Seed-spaces (Aankondigingen/Introducties/Crypto/Premium analyses) + welkomstpost | Vervang/voeg echte spaces & content toe |
| 6 | `prisma/seed.ts` — event | Voorbeeld-event "InvestorClub Live Avond" (Gent, 15-09-2026, €1 waarborg / €29 ticket) | Vervang door echte events (kan ook via /admin/events) |
| 7 | `prisma/seed.ts` — academy | Voorbeeldcursus "Crypto Basis" + 3 lessen + 1 quiz | Vervang door echte cursussen (via /admin/courses) |
| 8 | `prisma/seed.ts` — levels/badges | Gamification-levels (Starter…Legende) + badges (founding, first_post) | Stem af op gewenste gamification |
| 9 | Analytics MRR (`/admin/analytics`) | MRR-schatting gebruikt de **placeholder tier-prijzen** (#4) | Wordt vanzelf juist zodra prijzen + echte abonnementen live zijn |

## 🔑 Dummy keys (in `.env.local`, gitignored — niet echt)

| # | Variabele | Status |
|---|-----------|--------|
| 10 | `AUTH_SECRET` | dev-placeholder → genereer een echte met `npx auth secret` |
| 11 | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | `dev-…` → echte Google OAuth-credentials |
| 12 | `AUTH_RESEND_KEY` + `EMAIL_FROM` | `dev-…` → echte Resend-key + geverifieerd domein |
| 13 | `ANTHROPIC_API_KEY` | `dev-…` → echte Claude API-key (voor AI-laag) |
| 14 | `STRIPE_*` | **test**-keys (`sk_test`/`pk_test`) → live keys + Connect-onboarding + webhook-secret |
| 15 | Supabase keys/DB | **echt** (test-project), DB live ✅ |

> Zoek in de code op `MOCK` (hoofdletters) om alle fictieve-data-plekken terug te vinden.
