import { computeStandings } from "./scoring";
import { scoutFor } from "./scouting";
import { oddsFor } from "./odds";
import type { LeagueState } from "./types";

/**
 * Family-league win probability: Monte-Carlo the rest of the season.
 *
 * Each simulated week: an HOH and veto winner are drawn weighted by comp
 * strength (scouting rank blended with comps actually won), one non-HOH
 * houseguest is evicted weighted inversely by Kalshi win odds, and points
 * are awarded per the league's own scoring rules (survive/jury/F3/finale).
 * Starting from current visible points, the share of simulations each team
 * wins is its chance. Seeded RNG → same inputs, same number on every
 * device, and only gate-visible data goes in, so nothing here can spoil.
 */

const SIMS = 2000;
const MAKES_JURY = 11;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T>(
  items: T[],
  weight: (x: T) => number,
  rnd: () => number,
): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let roll = rnd() * total;
  for (const it of items) {
    roll -= weight(it);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

export function leagueWinOdds(
  state: LeagueState,
): Record<string, number> | null {
  if (state.picks.length === 0 || state.teams.length === 0) return null;
  if (state.houseguests.some((h) => h.status === "winner")) return null; // season decided

  const rulePts = (id: string, fallback: number): number =>
    state.rules.find((r) => r.id === id)?.points ?? fallback;
  const PTS = {
    hoh: rulePts("r-hoh", 10),
    veto: rulePts("r-pov", 8),
    survive: rulePts("r-survive-week", 2),
    jury: rulePts("r-jury", 5),
    final3: rulePts("r-final3", 10),
    runnerup: rulePts("r-runnerup", 20),
    winner: rulePts("r-winner", 40),
    afp: rulePts("r-afp", 10),
  };

  const teamOf = new Map(state.picks.map((p) => [p.houseguestId, p.teamId]));
  const oddsList = state.odds?.list ?? [];

  // Per-houseguest model inputs.
  const compWinsSoFar = new Map<string, number>();
  for (const e of state.events) {
    if (["r-hoh", "r-pov", "r-comp"].includes(e.ruleId)) {
      compWinsSoFar.set(
        e.houseguestId,
        (compWinsSoFar.get(e.houseguestId) ?? 0) + 1,
      );
    }
  }
  interface Sim {
    id: string;
    comp: number; // comp-win propensity
    stay: number; // survival weight (market-implied)
  }
  const field: Sim[] = state.houseguests
    .filter((h) => h.status === "active")
    .map((h) => {
      const rank = scoutFor(h.name)?.rank ?? 9;
      const pct = oddsFor(oddsList, h.name) ?? 5;
      return {
        id: h.id,
        comp: 18 - rank + 3 * (compWinsSoFar.get(h.id) ?? 0),
        stay: pct + 2, // +2 floor so nobody is a lock to go
      };
    });
  if (field.length < 4) return null; // endgame — too little left to simulate

  const basePoints = new Map(
    computeStandings(state).map((s) => [s.team.id, s.points]),
  );
  const startedAboveJury = field.length > MAKES_JURY;
  const startedAboveF3 = field.length > 3;

  // Deterministic seed from the visible inputs.
  const seed =
    field.length * 131071 +
    state.events.length * 977 +
    (state.odds?.gateKey ?? 0) * 31 +
    state.picks.length;

  const rnd = mulberry32(seed);
  const wins = new Map<string, number>(state.teams.map((t) => [t.id, 0]));

  for (let s = 0; s < SIMS; s++) {
    const pts = new Map(basePoints);
    const add = (hgId: string, amount: number) => {
      const teamId = teamOf.get(hgId);
      if (teamId) pts.set(teamId, (pts.get(teamId) ?? 0) + amount);
    };
    let active = [...field];

    while (active.length > 3) {
      const hoh = weightedPick(active, (x) => x.comp, rnd);
      add(hoh.id, PTS.hoh);
      add(weightedPick(active, (x) => x.comp, rnd).id, PTS.veto);
      const nominees = active.filter((x) => x.id !== hoh.id);
      const evicted = weightedPick(nominees, (x) => 1 / x.stay, rnd);
      active = active.filter((x) => x.id !== evicted.id);
      for (const x of active) add(x.id, PTS.survive);
      if (startedAboveJury && active.length === MAKES_JURY) {
        for (const x of active) add(x.id, PTS.jury);
      }
    }
    if (startedAboveF3) for (const x of active) add(x.id, PTS.final3);
    const champ = weightedPick(active, (x) => x.stay, rnd);
    add(champ.id, PTS.winner);
    const runner = weightedPick(
      active.filter((x) => x.id !== champ.id),
      (x) => x.stay,
      rnd,
    );
    add(runner.id, PTS.runnerup);
    add(weightedPick(field, (x) => x.stay, rnd).id, PTS.afp);

    // Credit the winning team(s); ties split the win.
    let best = -Infinity;
    for (const v of pts.values()) best = Math.max(best, v);
    const leaders = state.teams.filter((t) => (pts.get(t.id) ?? 0) === best);
    for (const t of leaders) {
      wins.set(t.id, (wins.get(t.id) ?? 0) + 1 / leaders.length);
    }
  }

  const out: Record<string, number> = {};
  for (const t of state.teams) {
    out[t.id] = Math.round(((wins.get(t.id) ?? 0) / SIMS) * 100);
  }
  return out;
}

// Render-friendly cache: the store's view object is referentially stable
// between state changes, so one simulation per distinct state.
const simCache = new WeakMap<LeagueState, Record<string, number> | null>();
export function leagueWinOddsCached(
  state: LeagueState,
): Record<string, number> | null {
  if (!simCache.has(state)) simCache.set(state, leagueWinOdds(state));
  return simCache.get(state) ?? null;
}
