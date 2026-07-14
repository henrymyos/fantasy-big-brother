"use client";

import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { scoutFor } from "@/lib/scouting";
import { displayName } from "@/lib/wiki";
import type { DraftPick, Houseguest, Team } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

/**
 * Draft report card: letter grades from pre-season scouting value (how far
 * below their projected rank each pick was grabbed), plus the steal, the
 * reach, and the best pick by actual points. Grades never change — they're
 * frozen draft-night takes to argue about all season.
 */

interface GradedPick {
  pick: DraftPick;
  hg: Houseguest;
  team: Team;
  rank: number | null;
  /** overall − scouted rank; positive = got them later than projected. */
  value: number | null;
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

  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const rows: GradedPick[] = [];
  for (const pick of state.picks) {
    const hg = hgById.get(pick.houseguestId);
    const team = state.teams.find((t) => t.id === pick.teamId);
    if (!hg || !team) continue;
    const rank = scoutFor(hg.name)?.rank ?? null;
    rows.push({
      pick,
      hg,
      team,
      rank,
      value: rank === null ? null : pick.overall - rank,
    });
  }
  if (rows.length === 0) return null;

  const valued = rows.filter((r) => r.value !== null);
  let steal: GradedPick | null = null;
  let reach: GradedPick | null = null;
  for (const r of valued) {
    if (r.value! > 0 && (!steal || r.value! > steal.value!)) steal = r;
    if (r.value! < 0 && (!reach || r.value! < reach.value!)) reach = r;
  }

  const points = new Map(
    computeHouseguestScores(state).map((s) => [s.houseguest.id, s.points]),
  );
  let bestPick: GradedPick | null = null;
  for (const r of rows) {
    const pts = points.get(r.hg.id) ?? 0;
    if (pts > 0 && (!bestPick || pts > (points.get(bestPick.hg.id) ?? 0))) {
      bestPick = r;
    }
  }

  const teamValue = state.teams.map((team) => ({
    team,
    value: valued
      .filter((r) => r.team.id === team.id)
      .reduce((sum, r) => sum + r.value!, 0),
  }));

  const lines: string[] = [];
  if (steal) {
    lines.push(
      `💎 Steal of the draft: ${displayName(steal.hg.name)} to ${steal.team.name} at pick ${steal.pick.overall} — scouted #${steal.rank}.`,
    );
  }
  if (reach) {
    lines.push(
      `😬 Biggest gamble: ${displayName(reach.hg.name)} to ${reach.team.name} at pick ${reach.pick.overall} — scouted #${reach.rank}.`,
    );
  }
  if (bestPick) {
    lines.push(
      `🏆 Best pick so far: ${displayName(bestPick.hg.name)} (${bestPick.team.name}, pick ${bestPick.pick.overall}) — ${points.get(bestPick.hg.id)} pts.`,
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Draft report card"
        subtitle="Graded against the pre-season scouting ranks — locked in on draft night."
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
                title="Sum over picks of (pick number − scouted rank); positive means value fell to them"
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
