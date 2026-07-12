"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { teamOnTheClock, undraftedHouseguests } from "@/lib/scoring";
import { scoutFor } from "@/lib/scouting";
import { displayName } from "@/lib/wiki";
import type { Houseguest, Team } from "@/lib/types";
import { HouseguestCard } from "./HouseguestCard";
import { Avatar, Button, Card, EmptyState, Input } from "./ui";

/** Dark ink used on top of solid team-color pick cards. */
const CARD_INK = "#0b1020";

/** Board grid: one column per team, one row per round, snake numbering. */
function DraftGrid({
  teams,
  rounds,
  focusedTeamId,
  onFocusTeam,
  onOpenHouseguest,
}: {
  teams: Team[];
  rounds: number;
  focusedTeamId: string | null;
  onFocusTeam: (id: string | null) => void;
  onOpenHouseguest: (id: string) => void;
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
            {team.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="min-w-0 text-left text-xs font-bold truncate leading-tight">
            {team.name}
          </p>
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
        const out = hg.status === "evicted";
        cells.push(
          <button
            key={`${round}-${team.id}`}
            type="button"
            onClick={() => onOpenHouseguest(hg.id)}
            title={`About ${hg.name}`}
            className={`relative flex flex-col px-1.5 pt-1.5 pb-2 min-h-[104px] rounded-lg transition cursor-pointer hover:ring-2 hover:ring-white/30 hover:brightness-110${dim}`}
            style={{ background: team.color, color: CARD_INK }}
          >
            <span
              className="absolute top-1 right-1.5 text-[9px] font-mono leading-none"
              style={{ color: CARD_INK, opacity: 0.55 }}
            >
              {pickLabel}
            </span>
            {/* name on top */}
            <p
              className={`w-full px-2.5 text-center font-bold text-[15px] leading-tight truncate ${
                out ? "line-through opacity-60" : ""
              }`}
            >
              {displayName(hg.name)}
            </p>
            {/* photo fills the rest */}
            <div className="flex-1 grid place-items-center w-full pt-1">
              <Avatar
                name={hg.name}
                src={hg.photoUrl}
                active={!out}
                size={64}
                className="ring-2 ring-black/20"
              />
            </div>
          </button>,
        );
      } else if (isCurrent) {
        cells.push(
          <div
            key={`${round}-${team.id}`}
            className={`relative flex items-center justify-center p-1.5 min-h-[104px] rounded-lg bg-accent/10 ring-2 ring-accent ring-inset transition${dim}`}
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
            className={`flex flex-col p-1.5 min-h-[104px] rounded-lg bg-[var(--surface-2)]/60 transition${dim}`}
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
    draftHouseguest,
    resetDraft,
    shuffleDraftOrder,
    hiddenHouseguests,
    setHouseguestHidden,
  } = useStore();
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openHg, setOpenHg] = useState<string | null>(null);

  const clock = teamOnTheClock(state);
  const totalPicks = state.teams.length * state.picksPerTeam;
  const onClockTeam = state.teams.find((t) => t.id === clock.teamId);
  // Available pool, best projected fantasy value first (our scouting board).
  const available = undraftedHouseguests(state)
    .filter((h) => h.status !== "evicted")
    .filter(
      (h) => !search || h.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (scoutFor(a.name)?.rank ?? 99) - (scoutFor(b.name)?.rank ?? 99),
    );

  return (
    <div className="space-y-5">
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
                  {`${(onClockTeam?.name ?? "").toUpperCase()} IS ON THE CLOCK`}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={shuffleDraftOrder}
              disabled={state.picks.length > 0}
              title={
                state.picks.length > 0
                  ? "Order locks once drafting starts — Reset draft first"
                  : "Randomize who picks first"
              }
            >
              🎲 Shuffle order
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
            onOpenHouseguest={setOpenHg}
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
                · {available.length} undrafted · ranked by projected points
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
              {available.map((hg: Houseguest) => {
                const scout = scoutFor(hg.name);
                return (
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
                    <button
                      onClick={() => setOpenHg(hg.id)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                      title={`About ${hg.name}`}
                    >
                      <span className="text-[var(--muted)] text-xs font-mono w-7 text-right shrink-0 tabular-nums">
                        {scout ? `#${scout.rank}` : "—"}
                      </span>
                      <Avatar name={hg.name} src={hg.photoUrl} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {displayName(hg.name)}
                        </span>
                        {scout && (
                          <span className="block truncate text-[11px] text-[var(--muted)]">
                            {scout.strengths[0]}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {hiddenHouseguests.length > 0 && (
        <p className="text-xs text-[var(--muted)] px-1 flex items-center gap-2 flex-wrap">
          🙈 Hidden until they air on TV:
          {hiddenHouseguests.map((hg) => (
            <button
              key={hg.id}
              onClick={() => {
                if (
                  confirm(
                    `Reveal ${hg.name} for the whole family? Do this once their arrival has aired.`,
                  )
                )
                  setHouseguestHidden(hg.id, false);
              }}
              className="underline decoration-dotted hover:text-foreground cursor-pointer"
              title={`Reveal ${hg.name}`}
            >
              {hg.name} — reveal
            </button>
          ))}
        </p>
      )}

      {openHg && (
        <HouseguestCard houseguestId={openHg} onClose={() => setOpenHg(null)} />
      )}
    </div>
  );
}
