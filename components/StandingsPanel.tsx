"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { computeStandings, standingsByWeek } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { displayName } from "@/lib/wiki";
import { CatchUpDigest } from "./CatchUpDigest";
import { DraftReport } from "./DraftReport";
import { HouseguestCard } from "./HouseguestCard";
import { LeagueChat } from "./LeagueChat";
import { NextReveal } from "./NextReveal";
import { SeasonStats } from "./SeasonStats";
import { StandingsChart } from "./StandingsChart";
import { WeeklyRecap } from "./WeeklyRecap";
import { WinnerOdds } from "./WinnerOdds";
import { Avatar, Card, EmptyState, SectionTitle } from "./ui";

const MEDALS = ["🥇", "🥈", "🥉", "💩"];

export function StandingsPanel() {
  const { state } = useStore();
  const [openHg, setOpenHg] = useState<string | null>(null);
  const standings = computeStandings(state);
  const leader = standings[0];
  const champ = state.houseguests.find((h) => h.status === "winner");

  const winSim = simulateSeasonCached(state);
  const anyDrafted = state.picks.length > 0;
  const anyScored = anyDrafted && state.events.length > 0;
  const weekly = anyScored ? standingsByWeek(state) : null;

  return (
    <div className="grid lg:grid-cols-[1fr_330px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
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

      <CatchUpDigest />
      <NextReveal />

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {standings.map((s, i) => (
              <div key={s.team.id}>
                <div className="text-center text-2xl leading-none mb-1.5" aria-hidden>
                  {MEDALS[i] ?? ""}
                </div>
                <div
                  className="rounded-xl bg-[var(--surface-2)] overflow-hidden"
                  style={{ borderTop: `3px solid ${s.team.color}` }}
                >
                <div className="px-1 pt-1.5 pb-1 text-center">
                  <p className="text-sm font-bold truncate underline underline-offset-2">
                    {s.team.name}
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums leading-tight">
                    {s.points}
                  </p>
                  <p className="text-[9px] text-[var(--muted)]">pts</p>
                  {winSim && (
                    <p
                      className="text-[10px] font-semibold text-accent mt-0.5"
                      title="Chance to win the league — simulated from current points, Kalshi odds, and comp-win projections"
                    >
                      {winSim.teamPct[s.team.id] ?? 0}% to win
                    </p>
                  )}
                </div>
                <ul className="px-1 pb-1.5 space-y-0.5">
                  {s.houseguests.map((hs) => {
                    const out = hs.houseguest.status === "evicted";
                    return (
                      <li key={hs.houseguest.id}>
                        <button
                          onClick={() => setOpenHg(hs.houseguest.id)}
                          className="w-full flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-[var(--surface)] transition cursor-pointer text-left"
                          title={`View ${hs.houseguest.name}'s season`}
                        >
                          <Avatar
                            name={hs.houseguest.name}
                            src={hs.houseguest.photoUrl}
                            active={!out}
                            size={22}
                          />
                          <span
                            className={`flex-1 min-w-0 truncate text-sm font-medium ${
                              out ? "line-through text-red-400" : ""
                            }`}
                          >
                            {displayName(hs.houseguest.name)}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-[var(--muted)] shrink-0">
                            {hs.points}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {s.houseguests.length === 0 && (
                    <li className="text-xs text-[var(--muted)] px-1">
                      No picks yet.
                    </li>
                  )}
                </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {weekly && (
        <Card>
          <SectionTitle
            title="The race"
            subtitle="Cumulative team points, week by week."
          />
          <StandingsChart data={weekly} />
        </Card>
      )}

      <WeeklyRecap />
      <SeasonStats />
      <DraftReport />
      <WinnerOdds />
      </div>

      <LeagueChat />

      {openHg && (
        <HouseguestCard houseguestId={openHg} onClose={() => setOpenHg(null)} />
      )}
    </div>
  );
}
