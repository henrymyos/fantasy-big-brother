"use client";

import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { evictionAirTime, gateKey } from "@/lib/schedule";
import { displayName } from "@/lib/wiki";
import type { EvictionPrediction } from "@/lib/types";
import { Card, SectionTitle } from "./ui";

/**
 * Eviction pick'em: everyone calls who goes home. Picks stay editable
 * until the live eviction episode starts airing (Thursday 9pm ET), then
 * lock; the scoreboard settles on its own when the eviction reveals in
 * the app (Friday night). Honor system — you pick on your own row.
 */

// A coarse clock (30s buckets) that's SSR-safe: 0 on the server, real time
// after hydration, and re-renders as the lock moment passes.
function subscribeClock(cb: () => void): () => void {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
const clockNow = () => Math.floor(Date.now() / 30_000);
const clockServer = () => 0;

export function EvictionPickem() {
  const { state, setEvictionPick } = useStore();
  const bucket = useSyncExternalStore(subscribeClock, clockNow, clockServer);

  if (bucket === 0) return null; // server render / first hydration frame
  if (state.picks.length === 0) return null;
  if (state.houseguests.some((h) => h.status === "winner")) return null;
  const gate = state.revealed;
  if (!gate) return null; // no-gate mode: results land instantly, no game

  const now = bucket * 30_000;
  // The week whose eviction is still unseen: the gate week until its full
  // reveal, then the next one.
  const pickWeek = gate.stage >= 3 ? gate.week + 1 : gate.week;
  const lockAt = evictionAirTime(pickWeek);
  const locked = lockAt === null || now >= lockAt;

  const effective = new Map<string, EvictionPrediction>();
  for (const p of state.predictions ?? []) {
    const key = `${p.week}|${p.teamId}`;
    const cur = effective.get(key);
    if (!cur || p.at > cur.at) effective.set(key, p);
  }
  const pickFor = (week: number, teamId: string) =>
    effective.get(`${week}|${teamId}`) ?? null;

  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const candidates = state.houseguests
    .filter((h) => h.status === "active")
    .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));

  // Score every fully revealed week that had an eviction.
  const history: {
    week: number;
    evictedNames: string;
    results: { teamId: string; pickName: string | null; correct: boolean }[];
  }[] = [];
  const tally = new Map(state.teams.map((t) => [t.id, 0]));
  for (let w = gate.stage >= 3 ? gate.week : gate.week - 1; w >= 1; w--) {
    if (gateKey(gate) < w * 10 + 3) continue;
    const actual = state.houseguests.filter(
      (h) =>
        h.exitWeek === w && (h.status === "evicted" || h.status === "jury"),
    );
    if (actual.length === 0) continue; // no eviction that week — nothing to score
    const actualIds = new Set(actual.map((h) => h.id));
    const results = state.teams.map((team) => {
      const p = pickFor(w, team.id);
      const hg = p ? hgById.get(p.houseguestId) : null;
      const correct = p !== null && actualIds.has(p.houseguestId);
      if (correct) tally.set(team.id, (tally.get(team.id) ?? 0) + 1);
      return {
        teamId: team.id,
        pickName: hg ? displayName(hg.name) : null,
        correct,
      };
    });
    history.push({
      week: w,
      evictedNames: actual.map((h) => displayName(h.name)).join(" & "),
      results,
    });
  }

  const anyHistory = history.length > 0;
  const showPicker = lockAt !== null;
  if (!showPicker && !anyHistory) return null;

  const fmt = (t: number) =>
    new Date(t).toLocaleString([], { weekday: "short", hour: "numeric" });

  return (
    <Card>
      <SectionTitle
        title="Eviction pick'em"
        subtitle="Call who goes home. Picks lock when the live show starts; the scoreboard settles at the Friday reveal."
        right={
          anyHistory ? (
            <div className="flex items-center gap-2.5">
              {state.teams.map((t) => (
                <span key={t.id} className="flex items-center gap-1 text-xs">
                  <span
                    className="size-2 rounded-full inline-block"
                    style={{ background: t.color }}
                  />
                  <span className="font-mono font-bold tabular-nums">
                    {tally.get(t.id) ?? 0}
                  </span>
                </span>
              ))}
            </div>
          ) : undefined
        }
      />

      {showPicker && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
            <p className="text-sm font-semibold">
              Week {pickWeek} eviction
            </p>
            <p className="text-xs text-[var(--muted)]">
              {locked
                ? "🔒 Locked — results reveal Friday night"
                : `Picks lock ${fmt(lockAt)} when the show starts`}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {state.teams.map((team) => {
              const current = pickFor(pickWeek, team.id);
              const currentHg = current
                ? hgById.get(current.houseguestId)
                : null;
              return (
                <label
                  key={team.id}
                  className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-2"
                >
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ background: team.color }}
                  />
                  <span className="text-sm font-medium w-14 shrink-0 truncate">
                    {team.name}
                  </span>
                  {locked ? (
                    <span
                      className={`flex-1 min-w-0 truncate text-sm text-right ${
                        currentHg ? "" : "text-[var(--muted)]"
                      }`}
                    >
                      {currentHg ? displayName(currentHg.name) : "no pick"}
                    </span>
                  ) : (
                    <select
                      value={current?.houseguestId ?? ""}
                      onChange={(e) => {
                        if (e.target.value)
                          setEvictionPick(pickWeek, team.id, e.target.value);
                      }}
                      className="flex-1 min-w-0 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-accent cursor-pointer"
                      aria-label={`${team.name}'s eviction pick`}
                    >
                      <option value="">— pick —</option>
                      {candidates.map((h) => (
                        <option key={h.id} value={h.id}>
                          {displayName(h.name)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {anyHistory && (
        <ul className={`space-y-1.5 ${showPicker ? "mt-3" : ""}`}>
          {history.map((h) => (
            <li
              key={h.week}
              className="flex items-center gap-3 text-sm flex-wrap"
            >
              <span className="text-[var(--muted)] text-xs font-mono w-9 shrink-0">
                Wk {h.week}
              </span>
              <span className="min-w-0">
                🚪 {h.evictedNames}
              </span>
              <span className="flex items-center gap-2 ml-auto">
                {h.results.map((r) => {
                  const team = state.teams.find((t) => t.id === r.teamId);
                  return (
                    <span
                      key={r.teamId}
                      className="flex items-center gap-1 text-xs"
                      title={
                        r.pickName
                          ? `${team?.name} picked ${r.pickName}`
                          : `${team?.name} made no pick`
                      }
                    >
                      <span
                        className="size-2 rounded-full inline-block"
                        style={{ background: team?.color }}
                      />
                      {r.correct ? "✅" : r.pickName ? "❌" : "—"}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
