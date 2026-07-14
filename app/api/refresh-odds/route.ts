import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoGate, gateKey, maxGate } from "@/lib/schedule";
import { FAMILY_LEAGUE_ID, LEAGUES_TABLE } from "@/lib/supabase";
import type { LeagueState } from "@/lib/types";

/**
 * Snapshot Kalshi's BB28 winner odds into the shared league — but only when
 * the spoiler gate has advanced since the last snapshot, so the odds shown
 * in the app never contain information newer than what the family has
 * watched. Hit daily by Vercel cron (after each reveal moment) and pinged
 * by clients that notice a stale snapshot; both are no-ops unless a new
 * reveal window has opened.
 */
export const dynamic = "force-dynamic";

const KALSHI_MARKETS =
  "https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=KXBIGBROTHER-26DEC31&limit=100";

interface KalshiMarket {
  yes_sub_title?: string;
  no_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
}

async function fetchKalshi(): Promise<{ name: string; pct: number }[]> {
  const res = await fetch(KALSHI_MARKETS, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { markets?: KalshiMarket[] };
  return (data.markets ?? [])
    .map((m) => {
      const name = m.yes_sub_title || m.no_sub_title || "";
      const bid = Number.parseFloat(m.yes_bid_dollars ?? "0") || 0;
      const ask = Number.parseFloat(m.yes_ask_dollars ?? "0") || 0;
      const last = Number.parseFloat(m.last_price_dollars ?? "0") || 0;
      const prob = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
      return { name, pct: Math.round(prob * 100) };
    })
    .filter((o) => o.name)
    .sort((a, b) => b.pct - a.pct);
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, reason: "unconfigured" });
  }
  const sb = createClient(url, anonKey);

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
    if (state.odds?.gateKey === key) {
      return NextResponse.json({ ok: true, skipped: true, gateKey: key });
    }

    const list = await fetchKalshi();
    if (list.length === 0) {
      return NextResponse.json({ ok: false, reason: "kalshi-empty" });
    }
    const next: LeagueState = {
      ...state,
      odds: {
        gateKey: key,
        takenAt: Date.now(),
        list,
        // Keep the snapshot being replaced so the UI can show movement
        // arrows between two family-safe points in time.
        prev: state.odds
          ? {
              gateKey: state.odds.gateKey,
              takenAt: state.odds.takenAt,
              list: state.odds.list,
            }
          : null,
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
      return NextResponse.json({ ok: true, gateKey: key, odds: list.length });
    }
    // conflict — another writer got there; loop and re-read
  }
  return NextResponse.json({ ok: false, reason: "conflict" });
}
