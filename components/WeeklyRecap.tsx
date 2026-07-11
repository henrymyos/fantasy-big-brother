"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Points, SectionTitle } from "./ui";

/**
 * Auto-written recap of a week, derived entirely from synced events — HOH,
 * veto, evictions, each team's haul, and who leads the league afterwards.
 */
export function WeeklyRecap() {
  const { state } = useStore();
  const [viewWeek, setViewWeek] = useState<number | null>(null);

  const rules = new Map(state.rules.map((r) => [r.id, r]));
  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );

  const lastWeek = state.events.reduce((m, e) => Math.max(m, e.week), 0);
  if (lastWeek === 0 || state.picks.length === 0) return null;
  const week = Math.min(viewWeek ?? lastWeek, lastWeek);

  const weekEvents = state.events.filter((e) => e.week === week);
  const namesFor = (ruleId: string): string[] => [
    ...new Set(
      weekEvents
        .filter((e) => e.ruleId === ruleId)
        .map((e) => hgById.get(e.houseguestId)?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const hohNames = namesFor("r-hoh");
  const vetoNames = namesFor("r-pov");
  const compNames = namesFor("r-comp");
  const evicted = state.houseguests.filter(
    (h) => h.exitWeek === week && (h.status === "evicted" || h.status === "jury"),
  );

  // Team totals: this week's haul and the running score through this week.
  const rows = state.teams
    .map((team) => {
      let weekPts = 0;
      let totalPts = 0;
      for (const e of state.events) {
        if (teamByHg.get(e.houseguestId)?.id !== team.id) continue;
        const pts = rules.get(e.ruleId)?.points ?? 0;
        if (e.week === week) weekPts += pts;
        if (e.week <= week) totalPts += pts;
      }
      return { team, weekPts, totalPts };
    })
    .sort((a, b) => b.totalPts - a.totalPts);
  const bestWeek = Math.max(...rows.map((r) => r.weekPts));

  const withTeam = (name: string): string => {
    const hg = state.houseguests.find((h) => h.name === name);
    const team = hg ? teamByHg.get(hg.id) : undefined;
    return team ? `${name} (${team.name})` : name;
  };

  const lines: string[] = [];
  if (hohNames.length)
    lines.push(`👑 ${hohNames.map(withTeam).join(" & ")} won Head of Household.`);
  if (vetoNames.length)
    lines.push(`🛡️ ${vetoNames.map(withTeam).join(" & ")} took the Power of Veto.`);
  if (compNames.length)
    lines.push(`🎯 ${compNames.map(withTeam).join(" & ")} won a competition.`);
  for (const hg of evicted) {
    const team = teamByHg.get(hg.id);
    lines.push(
      team
        ? `🚪 ${hg.name} was evicted — a blow for ${team.name}.`
        : `🚪 ${hg.name} was evicted.`,
    );
  }
  const leader = rows[0];
  if (leader && leader.totalPts > 0) {
    const tied = rows.filter((r) => r.totalPts === leader.totalPts);
    lines.push(
      tied.length > 1
        ? `🏆 ${tied.map((r) => r.team.name).join(" and ")} are tied for the lead.`
        : `🏆 ${leader.team.name} leads the league.`,
    );
  }

  return (
    <Card>
      <SectionTitle
        title={`Week ${week} in the house`}
        subtitle="Auto-written from the synced results."
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewWeek(Math.max(1, week - 1))}
              disabled={week <= 1}
              className="size-7 rounded-lg bg-[var(--surface-2)] grid place-items-center text-sm hover:brightness-125 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              onClick={() => setViewWeek(Math.min(lastWeek, week + 1))}
              disabled={week >= lastWeek}
              className="size-7 rounded-lg bg-[var(--surface-2)] grid place-items-center text-sm hover:brightness-125 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              aria-label="Next week"
            >
              ›
            </button>
          </div>
        }
      />
      {lines.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Nothing logged for this week yet.
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-1.5">
        {rows.map((r) => (
          <div key={r.team.id} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ background: r.team.color }}
            />
            <span className="flex-1 min-w-0 truncate">
              {r.team.name}
              {r.weekPts === bestWeek && bestWeek > 0 ? (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-accent font-semibold">
                  best week
                </span>
              ) : null}
            </span>
            <span className="w-12 text-right">
              <Points value={r.weekPts} />
            </span>
            <span className="w-14 text-right font-mono tabular-nums text-[var(--muted)] text-xs">
              {r.totalPts} total
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
