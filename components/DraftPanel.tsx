"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { teamOnTheClock, undraftedHouseguests } from "@/lib/scoring";
import type { Houseguest, Team } from "@/lib/types";
import { Avatar, Button, Card, EmptyState, Input, SectionTitle } from "./ui";

/** Dark ink used on top of solid team-color pick cards. */
const CARD_INK = "#0b1020";

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(" ");
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Board grid: one column per team, one row per round, snake numbering. */
function DraftGrid({
  teams,
  rounds,
  focusedTeamId,
  onFocusTeam,
}: {
  teams: Team[];
  rounds: number;
  focusedTeamId: string | null;
  onFocusTeam: (id: string | null) => void;
}) {
  const { state } = useStore();
  const clock = teamOnTheClock(state);
  const N = teams.length;
  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));

  const cells: React.ReactNode[] = [];

  // Team headers — click to spotlight that team's picks.
  teams.forEach((team) => {
    const isOnClock = team.id === clock.teamId && !clock.complete;
    const isFocused = focusedTeamId === team.id;
    const dimmed = focusedTeamId !== null && !isFocused;
    cells.push(
      <button
        key={`h-${team.id}`}
        type="button"
        onClick={() => onFocusTeam(isFocused ? null : team.id)}
        title={isFocused ? "Show all teams" : `Highlight ${team.name}'s picks`}
        className={`w-full px-2 pt-4 pb-1.5 rounded-lg transition flex flex-col justify-end cursor-pointer ${
          isOnClock ? "bg-accent/15" : "bg-[var(--surface-2)]"
        } ${
          isFocused
            ? "ring-2 ring-accent"
            : dimmed
              ? "opacity-40 hover:opacity-100"
              : "hover:brightness-125"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="size-6 rounded-full shrink-0 grid place-items-center text-[10px] font-bold"
            style={{ backgroundColor: team.color, color: CARD_INK }}
          >
            {(team.owner || team.name).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs font-bold truncate leading-tight">
              {team.name}
            </p>
            {team.owner && (
              <p className="text-[10px] text-[var(--muted)] truncate leading-tight">
                {team.owner}
              </p>
            )}
          </div>
        </div>
      </button>,
    );
  });

  // Round rows.
  for (let round = 1; round <= rounds; round++) {
    teams.forEach((team, i) => {
      const posInRound = round % 2 === 1 ? i + 1 : N - i;
      const pickNum = (round - 1) * N + posInRound;
      const pickLabel = `${round}.${posInRound}`;
      const pick = state.picks.find(
        (p) => p.teamId === team.id && p.round === round,
      );
      const hg = pick ? hgById.get(pick.houseguestId) : undefined;
      const isCurrent = !clock.complete && pickNum === clock.overall;
      const dim =
        focusedTeamId !== null && team.id !== focusedTeamId
          ? " opacity-30"
          : "";

      if (pick && hg) {
        const { first, last } = splitName(hg.name);
        const out = hg.status === "evicted";
        cells.push(
          <div
            key={`${round}-${team.id}`}
            className={`flex flex-col p-1.5 min-h-[64px] rounded-lg transition${dim}`}
            style={{ background: team.color, color: CARD_INK }}
          >
            <div className="flex justify-between items-start">
              <span
                className="text-[10px] font-mono leading-none pt-0.5"
                style={{ color: CARD_INK, opacity: 0.6 }}
              >
                {pickLabel}
              </span>
              <Avatar name={hg.name} src={hg.photoUrl} active={!out} size={20} />
            </div>
            <div
              className={`flex-1 flex flex-col justify-end mt-1 ${
                out ? "opacity-60" : ""
              }`}
            >
              {first && (
                <p
                  className={`text-[11px] leading-tight break-words ${
                    out ? "line-through" : ""
                  }`}
                  style={{ color: CARD_INK, opacity: 0.75 }}
                >
                  {first}
                </p>
              )}
              <p
                className={`font-bold text-sm leading-tight break-words ${
                  out ? "line-through" : ""
                }`}
              >
                {last}
              </p>
            </div>
          </div>,
        );
      } else if (isCurrent) {
        cells.push(
          <div
            key={`${round}-${team.id}`}
            className={`relative flex items-center justify-center p-1.5 min-h-[64px] rounded-lg bg-accent/10 ring-2 ring-accent ring-inset transition${dim}`}
          >
            <span className="absolute top-1.5 left-1.5 text-accent text-[10px] font-mono">
              {pickLabel}
            </span>
            <span className="text-accent text-xs font-bold animate-pulse">
              On the clock
            </span>
          </div>,
        );
      } else {
        cells.push(
          <div
            key={`${round}-${team.id}`}
            className={`flex flex-col p-1.5 min-h-[64px] rounded-lg bg-[var(--surface-2)]/60 transition${dim}`}
          >
            <span className="text-[10px] font-mono text-[var(--muted)]/50">
              {pickLabel}
            </span>
          </div>,
        );
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${N}, minmax(112px, 1fr))`,
          gap: "4px",
          minWidth: `${N * 116}px`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}

export function DraftPanel() {
  const {
    state,
    updateTeam,
    setLeagueShape,
    draftHouseguest,
    undoLastPick,
    resetDraft,
  } = useStore();
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const clock = teamOnTheClock(state);
  const totalPicks = state.teams.length * state.picksPerTeam;
  const onClockTeam = state.teams.find((t) => t.id === clock.teamId);
  const available = undraftedHouseguests(state)
    .filter((h) => h.status !== "evicted")
    .filter(
      (h) => !search || h.name.toLowerCase().includes(search.toLowerCase()),
    );

  const draftedCount = (teamId: string) =>
    state.picks.filter((p) => p.teamId === teamId).length;

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
                    setLeagueShape(Number(e.target.value), state.picksPerTeam)
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
                {draftedCount(team.id)} / {state.picksPerTeam} picks
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Draft board + available pool, one card like the big-screen boards */}
      <Card className="!p-0 overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 flex-wrap">
            {clock.complete ? (
              <span className="text-sm font-semibold text-emerald-300">
                🎉 Draft complete
              </span>
            ) : (
              <>
                <span className="text-sm font-semibold">
                  Round {clock.round} · Pick {clock.overall} of {totalPicks}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold animate-pulse"
                  style={{
                    background: `${onClockTeam?.color ?? "#888"}26`,
                    color: onClockTeam?.color,
                  }}
                >
                  {onClockTeam?.owner
                    ? `${onClockTeam.owner.toUpperCase()} IS ON THE CLOCK`
                    : `${onClockTeam?.name ?? ""} on the clock`}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undoLastPick}
              disabled={state.picks.length === 0}
            >
              Undo pick
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
        </div>

        {/* Board grid */}
        <div className="px-3 py-3">
          <DraftGrid
            teams={state.teams}
            rounds={state.picksPerTeam}
            focusedTeamId={focusedTeamId}
            onFocusTeam={setFocusedTeamId}
          />
          <p className="text-[11px] text-[var(--muted)] mt-2 px-1">
            Snake order — pick order reverses each round. Tap a team header to
            spotlight their picks.
          </p>
        </div>

        {/* Available panel */}
        <div className="border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <p className="text-sm font-semibold">
              Available{" "}
              <span className="text-[var(--muted)] font-normal">
                · {available.length} undrafted
              </span>
            </p>
            <Input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!w-40 !py-1 text-xs"
            />
          </div>
          {state.houseguests.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState>
                The cast syncs in from Wikipedia automatically — check back
                soon.
              </EmptyState>
            </div>
          ) : available.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-6">
              {search ? "No one matches that search." : "Everyone's been drafted."}
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto divide-y divide-[var(--border)]">
              {available.map((hg: Houseguest, idx: number) => (
                <li
                  key={hg.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--surface-2)] transition"
                >
                  <button
                    onClick={() => draftHouseguest(hg.id)}
                    disabled={clock.complete}
                    className="shrink-0 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-accent text-[#04263a] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title={
                      clock.complete
                        ? "Draft is complete"
                        : `Draft ${hg.name} to ${onClockTeam?.name}`
                    }
                  >
                    Draft
                  </button>
                  <span className="text-[var(--muted)] text-xs font-mono w-5 text-right shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <Avatar name={hg.name} src={hg.photoUrl} size={28} />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">
                    {hg.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
