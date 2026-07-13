import { NextResponse } from "next/server";

/**
 * Kalshi "Who will win Big Brother Season 28" market → win probability per
 * houseguest. Kalshi's API rejects browser origins, so this tiny route
 * proxies it server-side; responses are cached ~10 minutes.
 */
export const revalidate = 600;

const KALSHI_MARKETS =
  "https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=KXBIGBROTHER-26DEC31&limit=100";

interface KalshiMarket {
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

export async function GET() {
  try {
    const res = await fetch(KALSHI_MARKETS, { next: { revalidate: 600 } });
    if (!res.ok) return NextResponse.json({ odds: [] });
    const data = (await res.json()) as { markets?: KalshiMarket[] };
    const odds = (data.markets ?? [])
      .map((m) => {
        const name = m.yes_sub_title || m.no_sub_title || "";
        const bid = Number.parseFloat(m.yes_bid_dollars ?? "0") || 0;
        const ask = Number.parseFloat(m.yes_ask_dollars ?? "0") || 0;
        const last = Number.parseFloat(m.last_price_dollars ?? "0") || 0;
        // Mid-market when a two-sided book exists, else last trade.
        const prob = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
        return { name, pct: Math.round(prob * 100) };
      })
      .filter((o) => o.name)
      .sort((a, b) => b.pct - a.pct);
    return NextResponse.json({ odds, updatedAt: Date.now() });
  } catch {
    return NextResponse.json({ odds: [] });
  }
}
