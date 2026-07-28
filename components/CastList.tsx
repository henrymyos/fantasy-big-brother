"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { computeHouseguestScores } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { displayName } from "@/lib/wiki";
import type { Houseguest } from "@/lib/types";
import { HouseguestCard } from "./HouseguestCard";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * The whole cast in one table: points banked so far next to the sim's
 * projected end-of-season total, sorted by projection. Names wear their
 * drafting team's color; undrafted houseguests stay plain.
 */
export function CastList() {
  const { state } = useStore();
  const [openHg, setOpenHg] = useState<string | null>(null);

  if (state.houseguests.length === 0) return null;

  const actual = new Map(
    computeHouseguestScores(state).map((s) => [s.houseguest.id, s.points]),
  );
  const sim = simulateSeasonCached(state);
  const projected = (hgId: string): number =>
    sim ? sim.hgExpected[hgId] ?? 0 : actual.get(hgId) ?? 0;

  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId) ?? null,
    ]),
  );

  const rows = [...state.houseguests].sort(
    (a, b) =>
      projected(b.id) - projected(a.id) ||
      (actual.get(b.id) ?? 0) - (actual.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name),
  );
  const half = Math.ceil(rows.length / 2);
  const columns: { hg: Houseguest; rank: number }[][] = [
    rows.slice(0, half).map((hg, i) => ({ hg, rank: i + 1 })),
    rows.slice(half).map((hg, i) => ({ hg, rank: half + i + 1 })),
  ];

  const header = (hiddenOnMobile: boolean) => (
    <div
      className={`items-center gap-2.5 px-1 pb-1 text-[10px] uppercase tracking-wide text-[var(--muted)] ${
        hiddenOnMobile ? "hidden sm:flex" : "flex"
      }`}
    >
      <span className="w-5 shrink-0" />
      <span className="w-[26px] shrink-0" />
      <span className="flex-1">Houseguest</span>
      <span className="w-10 text-right shrink-0">Pts</span>
      <span className="w-10 text-right shrink-0">Proj</span>
    </div>
  );

  return (
    <Card>
      <SectionTitle
        title="The whole cast"
        subtitle="Everyone in the house — points banked so far, and the sim's projected season total."
      />
      <div className="grid sm:grid-cols-2 gap-x-5">
        {columns.map((col, ci) => (
          <div key={ci}>
            {header(ci === 1)}
            {col.map(({ hg, rank }) => {
              const out =
                hg.status !== "active" &&
                hg.status !== "winner" &&
                hg.status !== "runnerup";
              const team = teamByHg.get(hg.id) ?? null;
              return (
                <button
                  key={hg.id}
                  onClick={() => setOpenHg(hg.id)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-[var(--surface-2)] transition cursor-pointer text-left"
                  title={
                    team
                      ? `${hg.name} — drafted by ${team.name}`
                      : `${hg.name} — undrafted`
                  }
                >
                  <span className="w-5 text-right text-[11px] font-mono tabular-nums text-[var(--muted)] shrink-0">
                    {rank}
                  </span>
                  <Avatar
                    name={hg.name}
                    src={hg.photoUrl}
                    active={!out}
                    size={26}
                  />
                  <span
                    className={`flex-1 min-w-0 truncate text-sm font-medium ${
                      out ? "line-through opacity-60" : ""
                    }`}
                    style={team ? { color: team.color } : undefined}
                  >
                    {displayName(hg.name)}
                  </span>
                  <span className="w-10 text-right text-sm font-mono tabular-nums shrink-0">
                    {actual.get(hg.id) ?? 0}
                  </span>
                  <span className="w-10 text-right text-sm font-mono tabular-nums text-[var(--muted)] shrink-0">
                    {projected(hg.id)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--muted)] mt-2 px-1">
        Ranked by projected total. Names are colored by the team that drafted
        them; plain names went undrafted.
      </p>
      {openHg && (
        <HouseguestCard houseguestId={openHg} onClose={() => setOpenHg(null)} />
      )}
    </Card>
  );
}
