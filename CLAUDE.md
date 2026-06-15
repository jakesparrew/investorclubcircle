# InvestorClub Platform — CLAUDE.md

Eigen community-/academy-platform van InvestorClub (Circle.so-vervanger + events, chat,
livestream, podcast, nieuwsbrief, cursussen, AI-laag). Volledige spec:
`docs/superpowers/specs/2026-06-15-platform-design.md`. Bouw gebeurt **fase per fase** (§14).
We bouwen nu **Fase 1 — Fundament**.

> Zie ook `AGENTS.md`: dit is Next.js 16 (breaking changes t.o.v. oudere versies).

## Stack (geïnstalleerde versies — NIET vertrouwen op oudere kennis)

- **Next.js 16.2.9** (App Router) + **React 19.2** + TypeScript, `src/`-dir, alias `@/*`.
- **Prisma 7.8** + `@prisma/client` (legacy `prisma-client-js` generator).
- **Auth.js v5** (`next-auth@5-beta`) + `@auth/prisma-adapter`, database sessions.
- **Stripe 22** (Connect, Standard accounts, 5% application fee).
- **Tailwind v4** (`@tailwindcss/postcss`, CSS-config in `globals.css`).
- **Supabase** (Postgres + Realtime + Storage), EU. **Vitest** voor tests.

## Kritieke conventies van deze versies

**Next.js 16**
- `middleware.ts` bestaat niet → gebruik **`src/proxy.ts`** met named export `proxy` (Node-runtime only).
- `cookies()`, `headers()`, `params`, `searchParams` zijn **async** → altijd `await`.
- Route handlers: raw body voor webhooks via `await req.text()`; zet `export const runtime = "nodejs"`.
- Turbopack is default voor dev én build. DB-rakende pagina's: `export const dynamic = "force-dynamic"`.
- Env: alleen `NEXT_PUBLIC_*` is client-side; rest server-only.

**Prisma 7**
- Schema `datasource` bevat **alleen `provider`** — connection-URLs staan in `prisma.config.ts`.
- Runtime client krijgt de URL via `new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })` (zie `src/lib/db.ts`).
- CLI laadt `.env` **niet** automatisch → `prisma.config.ts` laadt `.env.local`/`.env` via dotenv.
- `migrate diff --to-schema <path>` (niet meer `--to-schema-datamodel`); gebruik `--output`.

**Auth.js v5**
- `src/auth.ts` exporteert `{ handlers, auth, signIn, signOut }`. Magic-link = **Resend**-provider, vereist `session.strategy = "database"`.
- Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_RESEND_KEY`.
- `role` op de sessie via de `session({ session, user })` callback + augmentatie in `src/types/next-auth.d.ts`.

**Stripe 22**
- `apiVersion: "2026-05-27.dahlia"` (enige literal die type-checkt).
- Connect direct charge: 2e arg `{ stripeAccount }`. Subscriptions: `subscription_data.application_fee_percent`. One-time: `payment_intent_data.application_fee_amount`.

## Architectuurregels

- **`src/lib/access.ts` → `canAccess(ctx, requirement)`** is dé gating-functie. Puur + getest. Alles leunt erop.
- Resolved entitlements: `src/lib/access-context.ts` (`getAccessContext`).
- Externe diensten achter adapters (`src/lib/stripe.ts`, later mail/video).
- Toegang **altijd server-side** afdwingen (page/action), niet alleen via `proxy.ts`.
- Geld in cents (int). Per feature: done = werkt achter juiste gating + audit/log + test.

## Commando's

```
npm run dev            # next dev
npm run build          # next build
npm test               # vitest run
npm run typecheck      # tsc --noEmit
npm run db:generate    # prisma generate
npm run db:migrate     # prisma migrate dev   (DB vereist)
npm run db:seed        # seed org/tiers/admin  (DB vereist)
npm run db:studio      # prisma studio
```
