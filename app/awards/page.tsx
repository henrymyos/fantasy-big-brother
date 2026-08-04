"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { computeHouseguestScores, computeStandings } from "@/lib/scoring";
import { simulateSeasonCached } from "@/lib/simulate";
import { gateKey } from "@/lib/schedule";
import { oddsFor } from "@/lib/odds";
import { displayName } from "@/lib/wiki";
import type { EvictionPrediction } from "@/lib/types";
import { Card } from "@/components/ui";

/**
 * The trophy room. Every award is computed live from gate-visible data, so
 * before the finale it reads as "leaders so far"; once a winner is crowned
 * the language flips to final and the page becomes the season's keepsake.
 */

const MEDALS = ["🥇", "🥈", "🥉", "💩"];

interface Award {
  emoji: string;
  title: string;
  value: string;
  detail: string;
}

export default function AwardsPage() {
  const { state, loaded } = useStore();

  const champ = state.houseguests.find((h) => h.status === "winner");
  const done = Boolean(champ);
  const standings = computeStandings(state);
  const anyScored = state.picks.length > 0 && state.events.length > 0;

  const awards: Award[] = [];

  if (anyScored) {
    const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
    const teamByHg = new Map(
      state.picks.map((p) => [
        p.houseguestId,
        state.teams.find((t) => t.id === p.teamId),
      ]),
    );
    const rules = new Map(state.rules.map((r) => [r.id, r]));
    const scores = computeHouseguestScores(state);
    const actual = new Map(scores.map((s) => [s.houseguest.id, s.points]));

    // Draft value, same math as the report card.
    const sim = simulateSeasonCached(state);
    const worth = (hgId: string): number =>
      sim ? (sim.hgExpected[hgId] ?? 0) : (actual.get(hgId) ?? 0);
    const ranked = [...state.houseguests].sort(
      (a, b) => worth(b.id) - worth(a.id) || a.name.localeCompare(b.name),
    );
    const trueRank = new Map(ranked.map((h, i) => [h.id, i + 1]));
    let steal: { name: string; team: string; overall: number; v: number } | null =
      null;
    let bust: { name: string; team: string; overall: number; v: number } | null =
      null;
    for (const p of state.picks) {
      const hg = hgById.get(p.houseguestId);
      const team = teamByHg.get(p.houseguestId);
      if (!hg || !team) continue;
      const v = p.overall - trueRank.get(hg.id)!;
      const entry = {
        name: displayName(hg.name),
        team: team.name,
        overall: p.overall,
        v,
      };
      if (v > 0 && (!steal || v > steal.v)) steal = entry;
      if (v < 0 && (!bust || v < bust.v)) bust = entry;
    }

    // Top scorer + comp king.
    const topScorer = scores.find((s) => s.points > 0);
    const compWins = new Map<string, number>();
    for (const e of state.events) {
      if (["r-hoh", "r-pov", "r-comp"].includes(e.ruleId)) {
        compWins.set(e.houseguestId, (compWins.get(e.houseguestId) ?? 0) + 1);
      }
    }
    const compKing = [...compWins.entries()]
      .map(([id, n]) => ({ hg: hgById.get(id), n }))
      .filter((x) => x.hg)
      .sort((a, b) => b.n - a.n || a.hg!.name.localeCompare(b.hg!.name))[0];

    // Best single team-week.
    const weekTotals = new Map<string, number>();
    for (const e of state.events) {
      const team = teamByHg.get(e.houseguestId);
      if (!team) continue;
      const k = `${team.id}|${e.week}`;
      weekTotals.set(
        k,
        (weekTotals.get(k) ?? 0) + (rules.get(e.ruleId)?.points ?? 0),
      );
    }
    let bestWeek: { team: string; week: number; pts: number } | null = null;
    for (const [k, pts] of weekTotals) {
      if (bestWeek && pts <= bestWeek.pts) continue;
      const [teamId, week] = k.split("|");
      const team = state.teams.find((t) => t.id === teamId);
      if (team) bestWeek = { team: team.name, week: Number(week), pts };
    }

    // Pick'em champion.
    const gate = state.revealed;
    const effective = new Map<string, EvictionPrediction>();
    for (const p of state.predictions ?? []) {
      const k = `${p.week}|${p.teamId}`;
      const cur = effective.get(k);
      if (!cur || p.at > cur.at) effective.set(k, p);
    }
    const tally = new Map(state.teams.map((t) => [t.id, 0]));
    if (gate) {
      for (let w = 1; w <= gate.week; w++) {
        if (gateKey(gate) < w * 10 + 3) continue;
        const actualIds = new Set(
          state.houseguests
            .filter(
              (h) =>
                h.exitWeek === w &&
                (h.status === "evicted" || h.status === "jury"),
            )
            .map((h) => h.id),
        );
        if (actualIds.size === 0) continue;
        for (const team of state.teams) {
          const p = effective.get(`${w}|${team.id}`);
          if (p && actualIds.has(p.houseguestId)) {
            tally.set(team.id, (tally.get(team.id) ?? 0) + 1);
          }
        }
      }
    }
    const bestCalls = Math.max(0, ...tally.values());
    const callers = state.teams.filter((t) => tally.get(t.id) === bestCalls);

    // Market mover: odds now vs. their earliest appearance in the archive.
    const history = [...(state.oddsHistory ?? [])].sort(
      (a, b) => a.gateKey - b.gateKey,
    );
    let riser: { name: string; from: number; to: number } | null = null;
    let faller: { name: string; from: number; to: number } | null = null;
    if (history.length >= 2) {
      const latest = history[history.length - 1];
      for (const hg of state.houseguests) {
        const to = oddsFor(latest.list, hg.name);
        if (to === null) continue;
        let from: number | null = null;
        for (const snap of history) {
          from = oddsFor(snap.list, hg.name);
          if (from !== null) break;
        }
        if (from === null) continue;
        const d = to - from;
        if (d > 0 && (!riser || d > riser.to - riser.from)) {
          riser = { name: displayName(hg.name), from, to };
        }
        if (d < 0 && (!faller || d < faller.to - faller.from)) {
          faller = { name: displayName(hg.name), from, to };
        }
      }
    }

    const sofar = done ? "" : " (so far)";
    if (steal) {
      awards.push({
        emoji: "💎",
        title: `Steal of the draft${sofar}`,
        value: steal.name,
        detail: `${steal.team}, pick ${steal.overall} — outplaying it by ${steal.v} spots`,
      });
    }
    if (bust) {
      awards.push({
        emoji: "😬",
        title: `Toughest break${sofar}`,
        value: bust.name,
        detail: `${bust.team}, pick ${bust.overall} — ${-bust.v} spots under`,
      });
    }
    if (topScorer) {
      awards.push({
        emoji: "🏅",
        title: `Top scorer${sofar}`,
        value: displayName(topScorer.houseguest.name),
        detail: `${topScorer.points} pts · drafted by ${
          teamByHg.get(topScorer.houseguest.id)?.name ?? "nobody"
        }`,
      });
    }
    if (compKing?.hg) {
      awards.push({
        emoji: "🎯",
        title: `Comp king${sofar}`,
        value: displayName(compKing.hg.name),
        detail: `${compKing.n} competition ${compKing.n === 1 ? "win" : "wins"}`,
      });
    }
    if (bestWeek) {
      awards.push({
        emoji: "🔥",
        title: `Best single week${sofar}`,
        value: bestWeek.team,
        detail: `+${bestWeek.pts} pts in week ${bestWeek.week}`,
      });
    }
    if (bestCalls > 0) {
      awards.push({
        emoji: "🗳️",
        title: `Pick'em ${done ? "champion" : "leader"}`,
        value: callers.map((t) => t.name).join(" & "),
        detail: `${bestCalls} eviction${bestCalls === 1 ? "" : "s"} called right`,
      });
    }
    if (riser) {
      awards.push({
        emoji: "📈",
        title: "Market darling",
        value: riser.name,
        detail: `Kalshi ${riser.from}% → ${riser.to}%`,
      });
    }
    if (faller) {
      awards.push({
        emoji: "📉",
        title: "Biggest tumble",
        value: faller.name,
        detail: `Kalshi ${faller.from}% → ${faller.to}%`,
      });
    }
  }

  const champTeam = champ
    ? state.teams.find(
        (t) =>
          t.id ===
          state.picks.find((p) => p.houseguestId === champ.id)?.teamId,
      )
    : null;

  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-10 backdrop-blur bg-[var(--background)]/80 border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-[var(--muted)] hover:text-foreground transition"
          >
            ← Standings
          </Link>
          <h1 className="text-lg font-bold tracking-tight flex-1 text-center">
            🏅 Season awards
          </h1>
          <span className="w-20" aria-hidden />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1 space-y-5">
        {!loaded ? (
          <div className="text-center text-[var(--muted)] py-20">Loading…</div>
        ) : !anyScored ? (
          <Card>
            <p className="text-sm text-[var(--muted)] text-center py-8">
              Awards appear once the draft is done and the season starts
              scoring.
            </p>
          </Card>
        ) : (
          <>
            {!done && (
              <p className="text-sm text-[var(--muted)] text-center">
                The finale hasn&apos;t aired — everything below is the story so
                far, and it can all still change.
              </p>
            )}

            <Card
              className={
                done
                  ? "border-yellow-400/40 bg-gradient-to-r from-yellow-400/10 to-transparent"
                  : ""
              }
            >
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl" aria-hidden>
                  {done ? "👑" : "🏁"}
                </span>
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {done
                      ? `${champ!.name} won Big Brother — drafted by ${
                          champTeam?.name ?? "nobody"
                        }`
                      : "Current league leader"}
                  </p>
                  <p className="text-xl font-bold">
                    {done
                      ? `${standings[0]?.team.name ?? "—"} wins the league`
                      : `${standings[0]?.team.name ?? "—"} · ${
                          standings[0]?.points ?? 0
                        } pts`}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {standings.map((s, i) => (
                  <li
                    key={s.team.id}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span className="w-6 text-center" aria-hidden>
                      {MEDALS[i] ?? ""}
                    </span>
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: s.team.color }}
                    />
                    <span className="flex-1 font-medium">{s.team.name}</span>
                    <span className="font-mono font-bold tabular-nums">
                      {s.points}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="grid sm:grid-cols-2 gap-3">
              {awards.map((a) => (
                <Card key={a.title} className="!p-4">
                  <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">
                    {a.emoji} {a.title}
                  </p>
                  <p className="text-lg font-bold mt-1">{a.value}</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {a.detail}
                  </p>
                </Card>
              ))}
            </div>

            {done && (
              <p className="text-xs text-[var(--muted)] text-center pb-4">
                That&apos;s a wrap on {state.seasonName}. 👁️
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
