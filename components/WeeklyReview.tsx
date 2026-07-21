"use client";

import { useStore } from "@/lib/store";
import { displayName } from "@/lib/wiki";
import type { LeagueState } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

/**
 * Week-by-week review: one card per week, newest on the left, scrolled
 * horizontally. Each card carries the week's highlights (HOH, veto, other
 * comps, evictions, milestones) and every team's point haul. Reads the
 * gated view, so a week mid-reveal simply shows what's aired so far.
 */

const MILESTONE_META: Record<string, { emoji: string; label: string }> = {
  "r-jury": { emoji: "⚖️", label: "Made jury" },
  "r-final3": { emoji: "🎬", label: "Final 3" },
  "r-runnerup": { emoji: "🥈", label: "Runner-up" },
  "r-winner": { emoji: "🏆", label: "Won Big Brother" },
  "r-afp": { emoji: "💛", label: "America's Favorite" },
};

/** A name tinted in its drafting team's color (null = undrafted). */
interface NameChunk {
  text: string;
  color: string | null;
}

interface WeekLine {
  emoji: string;
  label: string;
  detail: NameChunk[];
}

function buildWeek(state: LeagueState, week: number) {
  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );
  const rules = new Map(state.rules.map((r) => [r.id, r]));
  const evs = state.events.filter((e) => e.week === week);

  const chunkFor = (hgId: string): NameChunk | null => {
    const hg = hgById.get(hgId);
    if (!hg) return null;
    return {
      text: displayName(hg.name),
      color: teamByHg.get(hgId)?.color ?? null,
    };
  };
  const namesFor = (ruleId: string): NameChunk[] => {
    const seen = new Set<string>();
    const out: NameChunk[] = [];
    for (const e of evs) {
      if (e.ruleId !== ruleId || seen.has(e.houseguestId)) continue;
      seen.add(e.houseguestId);
      const chunk = chunkFor(e.houseguestId);
      if (chunk) out.push(chunk);
    }
    return out;
  };

  const lines: WeekLine[] = [];
  const hoh = namesFor("r-hoh");
  if (hoh.length) lines.push({ emoji: "👑", label: "HOH", detail: hoh });
  const veto = namesFor("r-pov");
  if (veto.length) lines.push({ emoji: "🛡️", label: "Veto", detail: veto });
  const comps = namesFor("r-comp");
  if (comps.length) lines.push({ emoji: "🎯", label: "Comps", detail: comps });

  const evicted = state.houseguests.filter(
    (h) =>
      h.exitWeek === week && (h.status === "evicted" || h.status === "jury"),
  );
  if (evicted.length)
    lines.push({
      emoji: "🚪",
      label: "Evicted",
      detail: evicted
        .map((h) => chunkFor(h.id))
        .filter((c): c is NameChunk => Boolean(c)),
    });

  for (const [ruleId, meta] of Object.entries(MILESTONE_META)) {
    const names = namesFor(ruleId);
    if (names.length === 0) continue;
    lines.push({
      emoji: meta.emoji,
      label: meta.label,
      // The jury line would be 11 names long — a count reads better.
      detail:
        names.length > 3
          ? [{ text: `${names.length} houseguests`, color: null }]
          : names,
    });
  }

  const survived = evs.filter((e) => e.ruleId === "r-survive-week").length;
  if (survived > 0)
    lines.push({
      emoji: "🌱",
      label: "Survived",
      detail: [{ text: `${survived} houseguests`, color: null }],
    });

  const teamRows = state.teams
    .map((team) => ({
      team,
      pts: evs.reduce(
        (sum, e) =>
          teamByHg.get(e.houseguestId)?.id === team.id
            ? sum + (rules.get(e.ruleId)?.points ?? 0)
            : sum,
        0,
      ),
    }))
    .sort((a, b) => b.pts - a.pts);

  return { lines, teamRows };
}

export function WeeklyReview() {
  const { state } = useStore();
  const lastWeek = state.events.reduce((m, e) => Math.max(m, e.week), 0);
  if (lastWeek === 0 || state.picks.length === 0) return null;

  const weeks = Array.from({ length: lastWeek }, (_, i) => lastWeek - i);

  return (
    <Card>
      <SectionTitle
        title="Week by week"
        subtitle="Newest first — scroll right for earlier weeks."
      />
      <div className="flex gap-2 overflow-x-auto snap-x pb-1 -mx-1 px-1">
        {weeks.map((week) => {
          const { lines, teamRows } = buildWeek(state, week);
          if (lines.length === 0 && teamRows.every((r) => r.pts === 0)) {
            return null;
          }
          const inProgress =
            state.revealed?.week === week && state.revealed.stage < 3;
          const best = teamRows[0]?.pts ?? 0;
          return (
            <div
              key={week}
              className="w-[250px] min-w-[250px] snap-start rounded-xl bg-[var(--surface-2)] p-3 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold">Week {week}</p>
                {inProgress && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                    In progress
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-xs flex-1">
                {lines.map((line) => (
                  <li key={line.label} className="flex gap-1.5 leading-snug">
                    <span className="shrink-0">{line.emoji}</span>
                    <span className="min-w-0">
                      <span className="text-[var(--muted)]">{line.label}:</span>{" "}
                      {line.detail.map((chunk, i) => (
                        <span key={i} className="font-semibold">
                          <span
                            style={
                              chunk.color ? { color: chunk.color } : undefined
                            }
                          >
                            {chunk.text}
                          </span>
                          {i < line.detail.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 pt-2 border-t border-[var(--border)] space-y-1">
                {teamRows.map(({ team, pts }) => (
                  <div key={team.id} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: team.color }}
                    />
                    <span className="flex-1 min-w-0 truncate">{team.name}</span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        pts === best && pts > 0
                          ? "text-accent"
                          : pts > 0
                            ? "text-emerald-300"
                            : "text-[var(--muted)]"
                      }`}
                    >
                      {pts > 0 ? `+${pts}` : pts}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
