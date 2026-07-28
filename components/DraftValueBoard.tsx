"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { displayName } from "@/lib/wiki";
import { HouseguestCard } from "./HouseguestCard";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * The draft board, replayed with hindsight: same snake grid as draft night,
 * but each pick's cell is shaded by how the pick looks today — deeper green
 * the more a houseguest is outplaying their draft slot, deeper red the more
 * they're underperforming it. Value math matches the draft report card:
 * pick number minus current rank by projected season points.
 */

/** Green↔red shade over the dark surface; full strength at ±10 slots. */
function valueShade(value: number): string {
  const t = Math.min(Math.abs(value) / 10, 1);
  if (value > 0) return `rgba(16, 185, 129, ${0.1 + 0.5 * t})`; // emerald-500
  if (value < 0) return `rgba(239, 68, 68, ${0.1 + 0.5 * t})`; // red-500
  return "var(--surface-2)";
}

export function DraftValueBoard() {
  const { state } = useStore();
  const [openHg, setOpenHg] = useState<string | null>(null);

  const totalSlots = state.teams.length * state.picksPerTeam;
  if (totalSlots === 0 || state.picks.length < totalSlots) return null;

  // Same "worth today" ranking the report card grades from.
  const sim = simulateSeasonCached(state);
  const actual = new Map(
    computeHouseguestScores(state).map((s) => [s.houseguest.id, s.points]),
  );
  const worth = (hgId: string): number =>
    sim ? sim.hgExpected[hgId] ?? 0 : actual.get(hgId) ?? 0;
  const ranked = [...state.houseguests].sort(
    (a, b) => worth(b.id) - worth(a.id) || a.name.localeCompare(b.name),
  );
  const trueRank = new Map(ranked.map((h, i) => [h.id, i + 1]));

  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const N = state.teams.length;

  const cells: React.ReactNode[] = [];

  state.teams.forEach((team) => {
    cells.push(
      <div
        key={`h-${team.id}`}
        className="w-full px-2 pt-4 pb-1.5 rounded-lg bg-[var(--surface-2)] flex flex-col justify-end"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="size-6 rounded-full shrink-0 grid place-items-center text-[10px] font-bold text-[#0b1020]"
            style={{ backgroundColor: team.color }}
          >
            {team.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="min-w-0 text-left text-xs font-bold truncate leading-tight">
            {team.name}
          </p>
        </div>
      </div>,
    );
  });

  for (let round = 1; round <= state.picksPerTeam; round++) {
    state.teams.forEach((team, i) => {
      const posInRound = round % 2 === 1 ? i + 1 : N - i;
      const pick = state.picks.find(
        (p) => p.teamId === team.id && p.round === round,
      );
      const hg = pick ? hgById.get(pick.houseguestId) : undefined;
      if (!pick || !hg) {
        cells.push(
          <div
            key={`${round}-${team.id}`}
            className="min-h-[88px] rounded-lg bg-[var(--surface-2)]/60"
          >
            <span className="text-[10px] font-mono text-[var(--muted)]/50 p-1.5 block">
              {round}.{posInRound}
            </span>
          </div>,
        );
        return;
      }
      const rank = trueRank.get(hg.id)!;
      const value = pick.overall - rank;
      const out = hg.status === "evicted";
      cells.push(
        <button
          key={`${round}-${team.id}`}
          type="button"
          onClick={() => setOpenHg(hg.id)}
          title={`${displayName(hg.name)} — pick ${pick.overall}, worth #${rank} today (${value >= 0 ? "+" : ""}${value})`}
          className="relative flex flex-col px-1.5 pt-1.5 pb-2 min-h-[88px] rounded-lg transition cursor-pointer hover:ring-2 hover:ring-white/30 hover:brightness-110"
          style={{ background: valueShade(value) }}
        >
          <span
            className={`absolute top-1 right-1.5 text-[10px] font-mono font-bold tabular-nums ${
              value > 0
                ? "text-emerald-200"
                : value < 0
                  ? "text-red-200"
                  : "text-[var(--muted)]"
            }`}
          >
            {value >= 0 ? `+${value}` : value}
          </span>
          <p
            className={`w-full px-0.5 text-center font-bold text-[13px] leading-tight truncate ${
              out ? "line-through opacity-60" : ""
            }`}
          >
            {displayName(hg.name)}
          </p>
          <div className="flex-1 grid place-items-center w-full pt-1">
            <Avatar
              name={hg.name}
              src={hg.photoUrl}
              active={!out}
              size={52}
              className="ring-2 ring-black/20"
            />
          </div>
        </button>,
      );
    });
  }

  return (
    <Card>
      <SectionTitle
        title="Draft board, in hindsight"
        subtitle="Same board, re-shaded by how each pick looks today — deeper green the bigger the steal, deeper red the bigger the reach."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
          gap: "4px",
        }}
      >
        {cells}
      </div>
      <p className="text-[11px] text-[var(--muted)] mt-2 px-1 flex items-center gap-1.5 flex-wrap">
        <span
          className="inline-block h-2.5 w-16 rounded-full"
          style={{
            background:
              "linear-gradient(to right, rgba(239,68,68,0.6), var(--surface-2), rgba(16,185,129,0.6))",
          }}
        />
        reach ← draft slot vs. worth today → steal · +N means they&apos;re
        worth N spots more than where they went.
      </p>
      {openHg && (
        <HouseguestCard houseguestId={openHg} onClose={() => setOpenHg(null)} />
      )}
    </Card>
  );
}
