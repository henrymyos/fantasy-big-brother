import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { airTimeForGate, autoGate, gateKey, maxGate } from "@/lib/schedule";
import { FAMILY_LEAGUE_ID, LEAGUES_TABLE } from "@/lib/supabase";
import type { LeagueState } from "@/lib/types";

/**
 * Snapshot Kalshi's BB28 winner odds into the shared league — but only when
 * the spoiler gate has advanced since the last snapshot, and priced AS OF
 * THE MOMENT THE EPISODE AIRED (via Kalshi's candlestick history), not the
 * current market. Feed-watching bettors move the market ahead of TV — e.g.
 * the next HOH plays out on the feeds within hours of an eviction airing —
 * so a live price at reveal time would leak what the next episode holds.
 * Hit daily by Vercel cron (after each reveal moment) and pinged by clients
 * that notice a stale snapshot; both are no-ops unless a new reveal window
 * has opened. `?force=1` re-prices the current gate's snapshot in place.
 */
export const dynamic = "force-dynamic";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const EVENT_TICKER = "KXBIGBROTHER-26DEC31";
const SERIES_TICKER = "KXBIGBROTHER";

interface KalshiMarket {
  ticker?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

const dollars = (s: string | undefined): number => Number.parseFloat(s ?? "0") || 0;

/** Mid-market when both sides are quoted, else the last trade. */
const pctFrom = (bid: number, ask: number, last: number): number =>
  Math.round((bid > 0 && ask > 0 ? (bid + ask) / 2 : last) * 100);

/** A market's price at `asOf`, from the last hourly candle at or before it. */
async function historicalPct(
  ticker: string,
  asOf: number,
): Promise<number | null> {
  const end = Math.floor(asOf / 1000);
  const url =
    `${KALSHI_BASE}/series/${SERIES_TICKER}/markets/${ticker}/candlesticks` +
    `?start_ts=${end - 3 * 86_400}&end_ts=${end}&period_interval=60`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candlesticks?: {
        yes_bid?: { close_dollars?: string };
        yes_ask?: { close_dollars?: string };
        price?: { close_dollars?: string };
      }[];
    };
    const last = data.candlesticks?.[data.candlesticks.length - 1];
    if (!last) return null;
    return pctFrom(
      dollars(last.yes_bid?.close_dollars),
      dollars(last.yes_ask?.close_dollars),
      dollars(last.price?.close_dollars),
    );
  } catch {
    return null;
  }
}

/**
 * All winner markets priced as of `asOf` (episode air time). Null `asOf`
 * (pre-season, or a market with no history yet — created mid-season) falls
 * back to the live price.
 */
async function fetchKalshi(
  asOf: number | null,
): Promise<{ name: string; pct: number }[]> {
  const res = await fetch(
    `${KALSHI_BASE}/markets?event_ticker=${EVENT_TICKER}&limit=100`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { markets?: KalshiMarket[] };
  const markets = (data.markets ?? []).filter(
    (m) => m.yes_sub_title || m.no_sub_title,
  );

  const useHistory = asOf !== null && asOf < Date.now() - 60_000;
  const out: { name: string; pct: number }[] = [];
  for (const m of markets) {
    const live = pctFrom(
      dollars(m.yes_bid_dollars),
      dollars(m.yes_ask_dollars),
      dollars(m.last_price_dollars),
    );
    const pct =
      useHistory && m.ticker
        ? ((await historicalPct(m.ticker, asOf)) ?? live)
        : live;
    out.push({ name: (m.yes_sub_title || m.no_sub_title)!, pct });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, reason: "unconfigured" });
  }
  const sb = createClient(url, anonKey);
  const force = new URL(req.url).searchParams.get("force") === "1";

  // CAS with rebase-free retry: the snapshot is derived data, so on a
  // revision conflict we simply re-read and try again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await sb
      .from(LEAGUES_TABLE)
      .select("state,rev")
      .eq("id", FAMILY_LEAGUE_ID)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: false, reason: "no-league" });
    const state = data.state as LeagueState;

    const auto = autoGate(Date.now());
    const effective = state.revealed
      ? maxGate(state.revealed, auto)
      : auto;
    const key = gateKey(effective);
    if (!force && state.odds?.gateKey === key) {
      return NextResponse.json({ ok: true, skipped: true, gateKey: key });
    }

    const airAt = airTimeForGate(effective);
    const list = await fetchKalshi(airAt);
    if (list.length === 0) {
      return NextResponse.json({ ok: false, reason: "kalshi-empty" });
    }
    // Keep the snapshot being replaced for movement arrows; a forced
    // re-price of the same gate keeps its original `prev` instead.
    const samegate = state.odds?.gateKey === key;
    const next: LeagueState = {
      ...state,
      odds: {
        gateKey: key,
        takenAt: airAt ?? Date.now(),
        list,
        prev:
          state.odds && !samegate
            ? {
                gateKey: state.odds.gateKey,
                takenAt: state.odds.takenAt,
                list: state.odds.list,
              }
            : (state.odds?.prev ?? null),
      },
    };
    const { data: updated } = await sb
      .from(LEAGUES_TABLE)
      .update({
        state: next,
        rev: (data.rev as number) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", FAMILY_LEAGUE_ID)
      .eq("rev", data.rev)
      .select("rev");
    if (updated && updated.length > 0) {
      return NextResponse.json({
        ok: true,
        gateKey: key,
        odds: list.length,
        pricedAt: airAt ? new Date(airAt).toISOString() : "live",
      });
    }
    // conflict — another writer got there; loop and re-read
  }
  return NextResponse.json({ ok: false, reason: "conflict" });
}
