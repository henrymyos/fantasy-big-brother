"use client";

import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { displayName } from "@/lib/wiki";
import type { DraftPick, Houseguest, Team } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

/**
 * Draft report card, re-graded live. Every houseguest is ranked by their
 * projected end-of-season fantasy points from the Monte-Carlo sim — which
 * blends Kalshi win odds, comp form (scouting + observed wins), and points
 * already banked — and each pick is scored by how far below that ranking
 * it was made. Grades move as the season does; that's the fun.
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

export function DraftReport() {
  const { state } = useStore();
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

  const teamValue = state.teams.map((team) => ({
    team,
    value: rows
      .filter((r) => r.team.id === team.id)
      .reduce((sum, r) => sum + r.value, 0),
  }));

  const projected = (hgId: string): string =>
    sim ? `, projected ${sim.hgExpected[hgId] ?? 0} pts` : "";

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

  return (
    <Card>
      <SectionTitle
        title="Draft report card"
        subtitle="Re-graded live from Kalshi odds, comp form, and points banked — how each pick looks today, not on draft night."
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {teamValue.map(({ team, value }) => {
          const grade = gradeFor(value);
          return (
            <div
              key={team.id}
              className="rounded-xl bg-[var(--surface-2)] px-2 py-2.5 text-center"
              style={{ borderTop: `3px solid ${team.color}` }}
            >
              <p className="text-sm font-bold truncate">{team.name}</p>
              <p className={`text-2xl font-black leading-tight ${grade.cls}`}>
                {grade.letter}
              </p>
              <p
                className="text-[10px] text-[var(--muted)] font-mono tabular-nums"
                title="Sum over picks of (pick number − current worth); positive means the roster is outplaying its draft slots"
              >
                value {value >= 0 ? `+${value}` : value}
              </p>
            </div>
          );
        })}
      </div>
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
