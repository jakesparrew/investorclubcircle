# InvestorClub — Design System

A community + academy platform (Circle.so replacement) for a Flemish crypto community.
Stack: Next.js 16, React 19, Tailwind v4 (CSS-config in `globals.css`), shadcn-style primitives.

## Brand & tone
- Trustworthy fintech / analytics feel. Clean, modern, calm — not flashy.
- Primary brand color is a confident green (investing / growth).
- Language is Dutch (Flemish). Currency in EUR.

## Color tokens (shadcn/tweakcn semantic system — oklch)
Light:
- `--background` near-white, `--foreground` near-black
- `--primary` brand green ≈ `oklch(0.55 0.12 155)` (hex ~ #1f7a4d), `--primary-foreground` white
- `--card` white, `--card-foreground` foreground
- `--muted` very light gray, `--muted-foreground` mid gray
- `--accent` light green tint, `--border` light gray, `--ring` primary
- `--destructive` red; success green; warning amber
- Chart palette `--chart-1..5`: greens + complementary teal/amber/violet for data viz
Dark: deep neutral background (#0f0f11), elevated cards (#18181b), brighter green primary.

- Radius: `--radius: 0.65rem` (cards `rounded-xl`, controls `rounded-md`, pills `rounded-full`).
- Font: system sans (`ui-sans-serif, system-ui, "Segoe UI", Roboto, …`).

## Primitives (shadcn conventions, already in `src/components/ui/`)
- **Button**: variants `default | brand(primary) | outline | ghost | destructive`; sizes `sm | default | lg | icon`. `inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium`.
- **Card**: `rounded-xl border bg-card`; `CardHeader / CardTitle / CardDescription / CardContent`.
- **Badge**: pill, variants `default | secondary | success | warning | danger`.
- **Avatar**: round image or initials.

## Dashboard intent
A member dashboard, analytics-style (Tremor/shadcn dashboard aesthetic):
- Top: greeting + tier/role, quick actions.
- KPI stat-card row: punten (points), streak, lidmaatschap/tier, voortgang cursussen — each with value, label, small delta/trend and an inline sparkline.
- A larger panel: points-over-time area chart (gamification) + level progress bar to next level.
- Right rail / lower grid: aankomende events, cursus-voortgang, recente community-activiteit, leaderboard-snippet (top 3 + own rank).
- Everything uses semantic tokens so a tweakcn export reskins it instantly. No text/buttons overflowing; fully responsive (1-col mobile → multi-col desktop).
