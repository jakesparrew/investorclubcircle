# Theming — tweakcn-driven

The whole app is wired to a single set of **shadcn/tweakcn semantic tokens** defined in
[`src/app/globals.css`](../src/app/globals.css) (the `:root` + `.dark` blocks). Every surface uses
`bg-card / text-foreground / text-muted-foreground / border-border / bg-primary / bg-accent /
bg-muted / chart-1..5`, so changing the tokens reskins the entire product — dashboard, community,
academy, events, admin, all of it.

## How to retheme (the "paste it and it applies everywhere" flow)

1. Open **https://tweakcn.com/editor/theme**.
2. Paste the export below to load the current InvestorClub theme, then tweak colors/radius live.
3. Hit **Copy / Export → CSS variables**. tweakcn gives you a `:root { … } .dark { … }` block.
4. Replace the `:root { … }` and `.dark { … }` blocks in `src/app/globals.css` with the export.
   Keep the `@custom-variant dark`, `@theme inline`, the `body` rule, and the legacy retrofit block
   below them — only the two token blocks change.
5. Done. `npm run dev` (or a rebuild) and the new theme is live everywhere.

> The `@theme inline` mapping keeps the back-compat aliases `--color-brand → var(--primary)` and
> `--color-surface → var(--muted)`, so older `bg-brand` / `bg-surface` utilities reskin too. Don't
> remove that mapping.

## Current export (InvestorClub Green)

```css
:root {
  --radius: 0.65rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.21 0.006 285.9);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.006 285.9);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.006 285.9);
  --primary: oklch(0.55 0.114 157.9);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.4);
  --secondary-foreground: oklch(0.21 0.006 285.9);
  --muted: oklch(0.967 0.001 286.4);
  --muted-foreground: oklch(0.552 0.014 285.9);
  --accent: oklch(0.95 0.03 157.9);
  --accent-foreground: oklch(0.37 0.08 157.9);
  --destructive: oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.92 0.004 286.3);
  --input: oklch(0.92 0.004 286.3);
  --ring: oklch(0.55 0.114 157.9);
  --chart-1: oklch(0.55 0.114 157.9);
  --chart-2: oklch(0.6 0.1 200);
  --chart-3: oklch(0.72 0.15 70);
  --chart-4: oklch(0.55 0.18 290);
  --chart-5: oklch(0.62 0.13 250);
}

.dark {
  --background: oklch(0.16 0.004 285.8);
  --foreground: oklch(0.96 0 0);
  --card: oklch(0.2 0.004 285.8);
  --card-foreground: oklch(0.96 0 0);
  --popover: oklch(0.2 0.004 285.8);
  --popover-foreground: oklch(0.96 0 0);
  --primary: oklch(0.68 0.14 158);
  --primary-foreground: oklch(0.16 0.01 158);
  --secondary: oklch(0.27 0.005 286);
  --secondary-foreground: oklch(0.96 0 0);
  --muted: oklch(0.26 0.005 286);
  --muted-foreground: oklch(0.71 0.01 286);
  --accent: oklch(0.3 0.04 158);
  --accent-foreground: oklch(0.9 0.05 158);
  --destructive: oklch(0.62 0.2 25);
  --destructive-foreground: oklch(0.96 0 0);
  --border: oklch(0.28 0.004 286);
  --input: oklch(0.3 0.004 286);
  --ring: oklch(0.68 0.14 158);
  --chart-1: oklch(0.68 0.14 158);
  --chart-2: oklch(0.65 0.1 200);
  --chart-3: oklch(0.75 0.15 70);
  --chart-4: oklch(0.62 0.18 290);
  --chart-5: oklch(0.66 0.13 250);
}
```

## One-line accent swaps

Want a different brand color without tweakcn? Change only `--primary` (and the dark `--primary`):

| Accent | light `--primary` | dark `--primary` |
| --- | --- | --- |
| Green (current) | `oklch(0.55 0.114 157.9)` | `oklch(0.68 0.14 158)` |
| Indigo | `oklch(0.55 0.18 277)` | `oklch(0.68 0.17 277)` |
| Blue | `oklch(0.55 0.16 250)` | `oklch(0.68 0.15 250)` |
| Violet | `oklch(0.55 0.2 300)` | `oklch(0.68 0.18 300)` |
| Amber | `oklch(0.68 0.16 70)` | `oklch(0.78 0.16 75)` |

Also set `--ring`, `--accent`/`--accent-foreground`, and `--chart-1` to the same hue for consistency.
