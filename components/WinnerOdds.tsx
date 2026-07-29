"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { oddsFor, pingOddsRefresh } from "@/lib/odds";
import { gateKey } from "@/lib/schedule";
import { displayName } from "@/lib/wiki";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * Kalshi win-the-season odds — a snapshot taken when the spoiler gate last
 * advanced, so the numbers can't hint at anything the family hasn't seen.
 */
const TOP_N = 6;

export function WinnerOdds() {
  const { state } = useStore();
  const [showAll, setShowAll] = useState(false);
  const snapshot = state.odds ?? null;

  // If the snapshot is missing or behind the current gate, ask the server
  // to refresh it (server re-checks the gate itself, so this can't force
  // an early update).
  const currentKey = gateKey(state.revealed);
  const stale = !snapshot || snapshot.gateKey !== currentKey;
  useEffect(() => {
    if (stale) pingOddsRefresh();
  }, [stale]);

  if (!snapshot || snapshot.list.length === 0) return null;

  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );
  const prevList = snapshot.prev?.list ?? null;
  const rows = state.houseguests
    .map((hg) => {
      const pct = oddsFor(snapshot.list, hg.name);
      const prev = prevList ? oddsFor(prevList, hg.name) : null;
      return {
        hg,
        pct,
        delta: pct !== null && prev !== null ? pct - prev : null,
      };
    })
    .filter((r): r is (typeof r) & { pct: number } => r.pct !== null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length === 0) return null;
  const maxPct = Math.max(1, ...rows.map((r) => r.pct));
  const asOf = new Date(snapshot.takenAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <Card>
      <SectionTitle
        title="Win odds"
        subtitle={`Kalshi's market as the last-revealed episode aired (${asOf}) — no hints about what's next.`}
      />
      <div className="space-y-1.5">
        {(showAll ? rows : rows.slice(0, TOP_N)).map(({ hg, pct, delta }) => {
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
              {prevList && (
                <span
                  className={`w-8 shrink-0 text-[10px] font-mono tabular-nums ${
                    delta && delta > 0
                      ? "text-emerald-300"
                      : delta && delta < 0
                        ? "text-red-300"
                        : "text-[var(--muted)]"
                  }`}
                  title="Movement since the previous reveal's snapshot"
                >
                  {delta ? (delta > 0 ? `▲${delta}` : `▼${-delta}`) : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {rows.length > TOP_N && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2.5 text-xs font-semibold text-[var(--muted)] hover:text-foreground transition cursor-pointer"
        >
          {showAll ? `Show top ${TOP_N}` : `Show all ${rows.length} ▾`}
        </button>
      )}
    </Card>
  );
}
