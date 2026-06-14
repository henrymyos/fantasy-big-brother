"use client";

import { useStore } from "@/lib/store";
import {
  snakeOrder,
  teamOnTheClock,
  undraftedHouseguests,
} from "@/lib/scoring";
import { Button, Card, EmptyState, Input, SectionTitle } from "./ui";

export function DraftPanel() {
  const {
    state,
    updateTeam,
    setLeagueShape,
    draftHouseguest,
    undoLastPick,
    resetDraft,
  } = useStore();

  const clock = teamOnTheClock(state);
  const order = snakeOrder(state.teams, state.picksPerTeam);
  const available = undraftedHouseguests(state).filter(
    (h) => h.status !== "evicted",
  );
  const onClockTeam = state.teams.find((t) => t.id === clock.teamId);
  const picksByTeam = (teamId: string) =>
    state.picks
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => a.overall - b.overall);
  const hgName = (id: string) =>
    state.houseguests.find((h) => h.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      {/* League shape + teams */}
      <Card>
        <SectionTitle
          title="Teams & league setup"
          subtitle="Name each team's owner and set how big the draft is."
          right={
            <div className="flex items-end gap-3">
              <label className="text-xs text-[var(--muted)]">
                Teams
                <Input
                  type="number"
                  min={2}
                  max={8}
                  value={state.teamCount}
                  onChange={(e) =>
                    setLeagueShape(
                      Number(e.target.value),
                      state.picksPerTeam,
                    )
                  }
                  className="w-20 mt-1"
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Picks / team
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={state.picksPerTeam}
                  onChange={(e) =>
                    setLeagueShape(state.teamCount, Number(e.target.value))
                  }
                  className="w-24 mt-1"
                />
              </label>
            </div>
          }
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {state.teams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-[var(--border)] p-3 bg-[var(--surface-2)]"
              style={{ borderTopColor: team.color, borderTopWidth: 3 }}
            >
              <input
                value={team.name}
                onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                className="bg-transparent font-semibold outline-none focus:underline w-full"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={team.color}
                  onChange={(e) =>
                    updateTeam(team.id, { color: e.target.value })
                  }
                  className="size-7 rounded cursor-pointer bg-transparent border-0"
                  aria-label={`${team.name} color`}
                />
                <input
                  value={team.owner}
                  onChange={(e) =>
                    updateTeam(team.id, { owner: e.target.value })
                  }
                  placeholder="Owner name"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)] focus:underline"
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">
                {picksByTeam(team.id).length} / {state.picksPerTeam} picks
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        {/* Draft board */}
        <Card>
          <SectionTitle
            title="Draft board"
            subtitle="Snake order — pick order reverses each round."
            right={
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undoLastPick}
                  disabled={state.picks.length === 0}
                >
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("Clear all draft picks?")) resetDraft();
                  }}
                  disabled={state.picks.length === 0}
                >
                  Reset draft
                </Button>
              </div>
            }
          />

          {clock.complete ? (
            <div className="rounded-xl bg-emerald-500/15 text-emerald-200 px-4 py-3 text-sm font-medium mb-4">
              🎉 Draft complete — every team is full. Head to Standings.
            </div>
          ) : (
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between"
              style={{ background: `${onClockTeam?.color ?? "#333"}22` }}
            >
              <div>
                <p className="text-xs text-[var(--muted)]">
                  Round {clock.round} · Pick {clock.overall} of {order.length}
                </p>
                <p className="font-semibold">
                  On the clock:{" "}
                  <span style={{ color: onClockTeam?.color }}>
                    {onClockTeam?.name}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {state.teams.map((team) => (
              <div key={team.id}>
                <div
                  className="text-sm font-semibold mb-2 pb-1 border-b-2"
                  style={{ color: team.color, borderColor: `${team.color}55` }}
                >
                  {team.name}
                </div>
                <ol className="space-y-1.5">
                  {Array.from({ length: state.picksPerTeam }).map((_, i) => {
                    const pick = picksByTeam(team.id)[i];
                    return (
                      <li
                        key={i}
                        className={`text-sm rounded-lg px-2.5 py-1.5 border ${
                          pick
                            ? "border-[var(--border)] bg-[var(--surface-2)]"
                            : "border-dashed border-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        <span className="text-[var(--muted)] mr-1.5 text-xs">
                          {i + 1}.
                        </span>
                        {pick ? hgName(pick.houseguestId) : "—"}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </Card>

        {/* Available pool */}
        <Card>
          <SectionTitle
            title="Available"
            subtitle={`${available.length} houseguests undrafted`}
          />
          {state.houseguests.length === 0 ? (
            <EmptyState>Add houseguests first.</EmptyState>
          ) : available.length === 0 ? (
            <EmptyState>Everyone&apos;s been drafted.</EmptyState>
          ) : (
            <ul className="space-y-1.5 max-h-[460px] overflow-auto pr-1">
              {available.map((hg) => (
                <li key={hg.id}>
                  <button
                    onClick={() => draftHouseguest(hg.id)}
                    disabled={clock.complete}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm hover:border-accent hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="font-medium">{hg.name}</span>
                    <span className="text-xs text-accent">Draft →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
