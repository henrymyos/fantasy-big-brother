"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchWinOdds, oddsFor, type WinOdds } from "@/lib/odds";
import { displayName } from "@/lib/wiki";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * Live win-the-season odds from Kalshi's prediction market, matched to the
 * cast and colored by the team that drafted each houseguest.
 */
export function WinnerOdds() {
  const { state } = useStore();
  const [odds, setOdds] = useState<WinOdds[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchWinOdds().then((o) => {
      if (active) setOdds(o);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!odds || odds.length === 0) return null;

  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );
  const rows = state.houseguests
    .map((hg) => ({ hg, pct: oddsFor(odds, hg.name) }))
    .filter((r): r is { hg: (typeof r)["hg"]; pct: number } => r.pct !== null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length === 0) return null;
  const maxPct = Math.max(1, ...rows.map((r) => r.pct));

  return (
    <Card>
      <SectionTitle
        title="Win odds"
        subtitle="Live from Kalshi's prediction market. Traders watch the feeds, so odds can run a little ahead of the episodes."
      />
      <div className="space-y-1.5">
        {rows.map(({ hg, pct }) => {
          const team = teamByHg.get(hg.id);
          const out = hg.status === "evicted";
          return (
            <div key={hg.id} className="flex items-center gap-2.5 text-sm">
              <Avatar name={hg.name} src={hg.photoUrl} active={!out} size={24} />
              <span
                className={`w-20 shrink-0 truncate ${
                  out ? "line-through text-[var(--muted)]" : ""
                }`}
              >
                {displayName(hg.name)}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(pct / maxPct) * 100}%`,
                    background: team?.color ?? "var(--muted)",
                  }}
                />
              </div>
              <span className="w-9 text-right font-mono tabular-nums text-xs">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
