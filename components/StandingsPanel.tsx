"use client";

import { useStore } from "@/lib/store";
import { computeStandings } from "@/lib/scoring";
import { Card, EmptyState, Points, SectionTitle, StatusBadge } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉"];

export function StandingsPanel() {
  const { state } = useStore();
  const standings = computeStandings(state);
  const leader = standings[0];
  const maxPoints = Math.max(1, ...standings.map((s) => s.points));
  const champ = state.houseguests.find((h) => h.status === "winner");

  const anyDrafted = state.picks.length > 0;

  return (
    <div className="space-y-5">
      {champ && leader && (
        <Card className="border-yellow-400/40 bg-gradient-to-r from-yellow-400/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="text-4xl">👑</div>
            <div>
              <p className="text-sm text-[var(--muted)]">
                {champ.name} won Big Brother
              </p>
              <p className="text-lg font-semibold">
                Drafted by{" "}
                {state.teams.find(
                  (t) =>
                    t.id ===
                    state.picks.find((p) => p.houseguestId === champ.id)
                      ?.teamId,
                )?.name ?? "nobody"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle
          title="Standings"
          subtitle="Team totals add up every point their drafted houseguests earn."
        />
        {!anyDrafted ? (
          <EmptyState>
            Run the draft to see standings come to life.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {standings.map((s, i) => (
              <div
                key={s.team.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 text-center text-lg font-bold tabular-nums">
                    {MEDALS[i] ?? s.rank}
                  </div>
                  <div
                    className="size-3 rounded-full shrink-0"
                    style={{ background: s.team.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">
                      {s.team.name}
                      {s.team.owner ? (
                        <span className="text-[var(--muted)] font-normal">
                          {" "}
                          · {s.team.owner}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {s.activeCount} still in the house
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono tabular-nums">
                      {s.points}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">
                      points
                    </div>
                  </div>
                </div>
                {/* progress bar */}
                <div className="h-1.5 bg-[var(--surface)]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(s.points / maxPoints) * 100}%`,
                      background: s.team.color,
                    }}
                  />
                </div>
                {/* roster */}
                <ul className="px-4 py-2.5 grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {s.houseguests.map((hs) => (
                    <li
                      key={hs.houseguest.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`flex-1 min-w-0 truncate ${
                          hs.houseguest.status === "evicted"
                            ? "line-through text-[var(--muted)]"
                            : ""
                        }`}
                      >
                        {hs.houseguest.name}
                      </span>
                      <StatusBadge status={hs.houseguest.status} />
                      <span className="w-10 text-right">
                        <Points value={hs.points} />
                      </span>
                    </li>
                  ))}
                  {s.houseguests.length === 0 && (
                    <li className="text-sm text-[var(--muted)]">
                      No picks yet.
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
