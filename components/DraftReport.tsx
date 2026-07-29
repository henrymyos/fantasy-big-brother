"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { displayName } from "@/lib/wiki";
import type { DraftPick, Houseguest, Team } from "@/lib/types";
import { HouseguestCard } from "./HouseguestCard";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * Draft report card, re-graded live: the draft-night board replayed with
 * hindsight. Every houseguest is ranked by projected end-of-season fantasy
 * points from the Monte-Carlo sim — Kalshi odds, comp form, points banked —
 * and each pick is scored by draft slot minus that rank. Team letter grades
 * head their board column, and every cell is shaded by its pick's value:
 * deeper green the bigger the steal, deeper red the bigger the reach.
 */

interface GradedPick {
  pick: DraftPick;
  hg: Houseguest;
  team: Team;
  /** Where the houseguest ranks today by projected season points. */
  rank: number;
  /** overall − rank; positive = they're outplaying their draft slot. */
  value: number;
}

function gradeFor(value: number): { letter: string; cls: string } {
  if (value >= 8) return { letter: "A+", cls: "text-emerald-300" };
  if (value >= 5) return { letter: "A", cls: "text-emerald-300" };
  if (value >= 2) return { letter: "A−", cls: "text-emerald-300" };
  if (value >= 0) return { letter: "B+", cls: "text-amber-200" };
  if (value >= -3) return { letter: "B", cls: "text-amber-200" };
  if (value >= -6) return { letter: "B−", cls: "text-amber-300" };
  if (value >= -9) return { letter: "C+", cls: "text-red-300" };
  return { letter: "C", cls: "text-red-300" };
}

/** Green↔red shade over the dark surface; full strength at ±10 slots. */
function valueShade(value: number): string {
  const t = Math.min(Math.abs(value) / 10, 1);
  if (value > 0) return `rgba(16, 185, 129, ${0.1 + 0.5 * t})`; // emerald-500
  if (value < 0) return `rgba(239, 68, 68, ${0.1 + 0.5 * t})`; // red-500
  return "var(--surface-2)";
}

export function DraftReport() {
  const { state } = useStore();
  const [openHg, setOpenHg] = useState<string | null>(null);

  const totalSlots = state.teams.length * state.picksPerTeam;
  if (totalSlots === 0 || state.picks.length < totalSlots) return null;

  // True value today: projected season points when the sim can run, actual
  // points once the season is decided and there's nothing left to project.
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
  const rows: GradedPick[] = [];
  for (const pick of state.picks) {
    const hg = hgById.get(pick.houseguestId);
    const team = state.teams.find((t) => t.id === pick.teamId);
    if (!hg || !team) continue;
    const rank = trueRank.get(hg.id)!;
    rows.push({ pick, hg, team, rank, value: pick.overall - rank });
  }
  if (rows.length === 0) return null;

  let steal: GradedPick | null = null;
  let regret: GradedPick | null = null;
  for (const r of rows) {
    if (r.value > 0 && (!steal || r.value > steal.value)) steal = r;
    if (r.value < 0 && (!regret || r.value < regret.value)) regret = r;
  }
  let bestPick: GradedPick | null = null;
  for (const r of rows) {
    const pts = actual.get(r.hg.id) ?? 0;
    if (pts > 0 && (!bestPick || pts > (actual.get(bestPick.hg.id) ?? 0))) {
      bestPick = r;
    }
  }
  // A high-value houseguest nobody drafted is its own kind of draft grade.
  const drafted = new Set(state.picks.map((p) => p.houseguestId));
  const benched = ranked.find(
    (h) => !drafted.has(h.id) && trueRank.get(h.id)! <= 8,
  );

  const projected = (hgId: string): string =>
    sim ? `, proj ${sim.hgExpected[hgId] ?? 0} pts` : "";

  const lines: string[] = [];
  if (steal) {
    lines.push(
      `💎 Steal of the draft: ${displayName(steal.hg.name)} to ${steal.team.name} at pick ${steal.pick.overall} — worth #${steal.rank} today${projected(steal.hg.id)}.`,
    );
  }
  if (regret) {
    lines.push(
      `😬 Toughest break: ${displayName(regret.hg.name)} (${regret.team.name}, pick ${regret.pick.overall}) — worth #${regret.rank} today${projected(regret.hg.id)}.`,
    );
  }
  if (bestPick) {
    lines.push(
      `🏆 Best pick so far: ${displayName(bestPick.hg.name)} (${bestPick.team.name}, pick ${bestPick.pick.overall}) — ${actual.get(bestPick.hg.id)} pts banked.`,
    );
  }
  if (benched) {
    lines.push(
      `🛋️ Still on the board: ${displayName(benched.name)} — worth #${trueRank.get(benched.id)} today${projected(benched.id)}.`,
    );
  }

  const N = state.teams.length;
  const cells: React.ReactNode[] = [];

  // Header row: each team's letter grade tops its own board column.
  state.teams.forEach((team) => {
    const value = rows
      .filter((r) => r.team.id === team.id)
      .reduce((sum, r) => sum + r.value, 0);
    const grade = gradeFor(value);
    cells.push(
      <div
        key={`g-${team.id}`}
        className="rounded-lg bg-[var(--surface-2)] px-1 py-2 text-center"
        style={{ borderTop: `3px solid ${team.color}` }}
        title="Sum over picks of (pick number − current worth); positive means the roster is outplaying its draft slots"
      >
        <p className="text-xs font-bold truncate">{team.name}</p>
        <p className={`text-xl font-black leading-tight ${grade.cls}`}>
          {grade.letter}
        </p>
        <p className="text-[10px] text-[var(--muted)] font-mono tabular-nums">
          {value >= 0 ? `+${value}` : value}
        </p>
      </div>,
    );
  });

  // Board rows: the snake draft, shaded by value.
  const rowByPick = new Map(rows.map((r) => [r.pick.id, r]));
  for (let round = 1; round <= state.picksPerTeam; round++) {
    state.teams.forEach((team, i) => {
      const posInRound = round % 2 === 1 ? i + 1 : N - i;
      const pick = state.picks.find(
        (p) => p.teamId === team.id && p.round === round,
      );
      const graded = pick ? rowByPick.get(pick.id) : undefined;
      if (!pick || !graded) {
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
      const { hg, rank, value } = graded;
      const out = hg.status === "evicted";
      cells.push(
        <button
          key={`${round}-${team.id}`}
          type="button"
          onClick={() => setOpenHg(hg.id)}
          title={`${displayName(hg.name)} — pick ${pick.overall}, proj ${worth(hg.id)} season pts (#${rank} of ${state.houseguests.length}) → ${value >= 0 ? "+" : ""}${value}`}
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
              size={44}
              className="ring-2 ring-black/20"
            />
          </div>
          <p className="w-full text-center text-[10px] font-mono tabular-nums opacity-70 leading-tight pt-0.5">
            proj {worth(hg.id)}
          </p>
        </button>,
      );
    });
  }

  return (
    <Card>
      <SectionTitle
        title="Draft report card"
        subtitle="Graded live from Kalshi odds, comp form, and points banked — the board shaded by how each pick looks today, not on draft night."
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
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {openHg && (
        <HouseguestCard houseguestId={openHg} onClose={() => setOpenHg(null)} />
      )}
    </Card>
  );
}
