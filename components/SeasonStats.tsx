"use client";

import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { displayName } from "@/lib/wiki";
import type { Houseguest } from "@/lib/types";
import { Avatar, Card, SectionTitle } from "./ui";

const COMP_RULES = new Set(["r-hoh", "r-pov", "r-comp"]);

function Stat({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
      <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">
        {emoji} {label}
      </p>
      <p className="text-sm font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/** Season superlatives + comp-wins leaderboard, from gate-visible data. */
export function SeasonStats() {
  const { state } = useStore();
  if (state.events.length === 0 || state.picks.length === 0) return null;

  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );
  const rules = new Map(state.rules.map((r) => [r.id, r]));

  // Competition wins per houseguest.
  const compWins = new Map<string, number>();
  for (const e of state.events) {
    if (!COMP_RULES.has(e.ruleId)) continue;
    compWins.set(e.houseguestId, (compWins.get(e.houseguestId) ?? 0) + 1);
  }
  const compBoard = [...compWins.entries()]
    .map(([id, n]) => ({ hg: hgById.get(id), n }))
    .filter((x): x is { hg: Houseguest; n: number } => Boolean(x.hg))
    .sort((a, b) => b.n - a.n || a.hg.name.localeCompare(b.hg.name));

  const topScorer = computeHouseguestScores(state).find((s) => s.points > 0);

  // Best single team-week.
  const weekTotals = new Map<string, number>();
  for (const e of state.events) {
    const team = teamByHg.get(e.houseguestId);
    if (!team) continue;
    const k = `${team.id}|${e.week}`;
    weekTotals.set(k, (weekTotals.get(k) ?? 0) + (rules.get(e.ruleId)?.points ?? 0));
  }
  let bestWeek: { teamId: string; week: number; pts: number } | null = null;
  for (const [k, pts] of weekTotals) {
    if (bestWeek && pts <= bestWeek.pts) continue;
    const [teamId, week] = k.split("|");
    bestWeek = { teamId, week: Number(week), pts };
  }
  const bestWeekTeam = bestWeek
    ? state.teams.find((t) => t.id === bestWeek.teamId)
    : null;

  if (!topScorer && compBoard.length === 0 && !bestWeek) return null;

  return (
    <Card>
      <SectionTitle
        title="Season stats"
        subtitle="Superlatives so far — only from episodes you've watched."
      />
      <div className="grid sm:grid-cols-3 gap-1.5">
        {topScorer && (
          <Stat
            emoji="🏆"
            label="Top scorer"
            value={`${displayName(topScorer.houseguest.name)} · ${topScorer.points} pts`}
            sub={
              teamByHg.get(topScorer.houseguest.id)
                ? `Drafted by ${teamByHg.get(topScorer.houseguest.id)!.name}`
                : "Undrafted"
            }
          />
        )}
        {compBoard.length > 0 && (
          <Stat
            emoji="🎯"
            label="Comp beast"
            value={`${displayName(compBoard[0].hg.name)} · ${compBoard[0].n} ${
              compBoard[0].n === 1 ? "win" : "wins"
            }`}
            sub={
              teamByHg.get(compBoard[0].hg.id)
                ? `Drafted by ${teamByHg.get(compBoard[0].hg.id)!.name}`
                : "Undrafted"
            }
          />
        )}
        {bestWeek && bestWeekTeam && (
          <Stat
            emoji="🔥"
            label="Best week"
            value={`${bestWeekTeam.name} · ${bestWeek.pts} pts`}
            sub={`Week ${bestWeek.week}`}
          />
        )}
      </div>
      {compBoard.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide mb-1.5">
            Comp wins
          </p>
          <div className="flex flex-wrap gap-1.5">
            {compBoard.map(({ hg, n }) => (
              <span
                key={hg.id}
                className="flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] pl-1 pr-2.5 py-1 text-xs font-medium"
              >
                <Avatar
                  name={hg.name}
                  src={hg.photoUrl}
                  active={hg.status !== "evicted"}
                  size={20}
                />
                {displayName(hg.name)}
                <span className="font-mono tabular-nums text-[var(--muted)]">
                  ×{n}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
