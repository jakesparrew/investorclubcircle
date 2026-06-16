// ─── MOCK PORTFOLIO ──────────────────────────────────────────────────────────
// FICTIONAL data until the real investeren.org API is wired up.
// Tracked in docs/MOCK_DATA.md. To go live: replace getMockPortfolio() with a
// real investeren.org API client keyed on PortfolioLink.externalAccountId, and
// fetch live prices instead of MOCK_PRICES.

export type Holding = { symbol: string; name: string; amount: number; priceCents: number };

// MOCK fixed prices in EUR cents (NOT live).
const MOCK_PRICES: Record<string, { name: string; priceCents: number }> = {
  BTC: { name: "Bitcoin", priceCents: 6_500_000 },
  ETH: { name: "Ethereum", priceCents: 320_000 },
  SOL: { name: "Solana", priceCents: 18_000 },
  ADA: { name: "Cardano", priceCents: 60 },
  LINK: { name: "Chainlink", priceCents: 2_200 },
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** MOCK: deterministic fictional holdings derived from the userId (stable per user). */
export function getMockPortfolio(userId: string): Holding[] {
  const h = hash(userId);
  return Object.entries(MOCK_PRICES).map(([symbol, meta], i) => {
    const raw = ((h >> (i * 3)) % 100) + 1; // 1..100
    const amount =
      symbol === "BTC"
        ? raw / 1000
        : symbol === "ETH"
          ? raw / 100
          : symbol === "SOL"
            ? raw / 5
            : raw * 5;
    return {
      symbol,
      name: meta.name,
      amount: Math.round(amount * 1000) / 1000,
      priceCents: meta.priceCents,
    };
  });
}

export function holdingValueCents(h: Holding): number {
  return Math.round(h.amount * h.priceCents);
}

export function portfolioTotalCents(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + holdingValueCents(h), 0);
}
