import type {
  DraftPick,
  Houseguest,
  LeagueState,
  ScoreEvent,
  ScoringRule,
  Team,
} from "./types";

export interface HouseguestScore {
  houseguest: Houseguest;
  points: number;
  eventCount: number;
}

export interface TeamStanding {
  team: Team;
  points: number;
  rank: number;
  houseguests: HouseguestScore[];
  activeCount: number;
}

function ruleMap(rules: ScoringRule[]): Record<string, ScoringRule> {
  return Object.fromEntries(rules.map((r) => [r.id, r]));
}

/** Points for a single houseguest from all logged events. */
export function houseguestPoints(
  houseguestId: string,
  events: ScoreEvent[],
  rules: Record<string, ScoringRule>,
): { points: number; eventCount: number } {
  let points = 0;
  let eventCount = 0;
  for (const e of events) {
    if (e.houseguestId !== houseguestId) continue;
    const rule = rules[e.ruleId];
    if (!rule) continue;
    points += rule.points;
    eventCount += 1;
  }
  return { points, eventCount };
}

export function computeHouseguestScores(state: LeagueState): HouseguestScore[] {
  const rules = ruleMap(state.rules);
  return state.houseguests
    .map((hg) => {
      const { points, eventCount } = houseguestPoints(
        hg.id,
        state.events,
        rules,
      );
      return { houseguest: hg, points, eventCount };
    })
    .sort((a, b) => b.points - a.points);
}

export function computeStandings(state: LeagueState): TeamStanding[] {
  const rules = ruleMap(state.rules);
  const picksByTeam: Record<string, DraftPick[]> = {};
  for (const pick of state.picks) {
    (picksByTeam[pick.teamId] ??= []).push(pick);
  }
  const hgById = Object.fromEntries(
    state.houseguests.map((h) => [h.id, h] as const),
  );

  const standings: TeamStanding[] = state.teams.map((team) => {
    const picks = (picksByTeam[team.id] ?? []).sort(
      (a, b) => a.overall - b.overall,
    );
    const houseguests: HouseguestScore[] = picks
      .map((p) => hgById[p.houseguestId])
      .filter((h): h is Houseguest => Boolean(h))
      .map((hg) => {
        const { points, eventCount } = houseguestPoints(
          hg.id,
          state.events,
          rules,
        );
        return { houseguest: hg, points, eventCount };
      });

    const points = houseguests.reduce((sum, h) => sum + h.points, 0);
    const activeCount = houseguests.filter(
      (h) =>
        h.houseguest.status === "active" ||
        h.houseguest.status === "winner" ||
        h.houseguest.status === "runnerup",
    ).length;

    return { team, points, rank: 0, houseguests, activeCount };
  });

  standings.sort((a, b) => b.points - a.points);
  // Dense ranking with ties.
  let lastPoints: number | null = null;
  let lastRank = 0;
  standings.forEach((s, i) => {
    if (lastPoints === null || s.points !== lastPoints) {
      lastRank = i + 1;
      lastPoints = s.points;
    }
    s.rank = lastRank;
  });
  return standings;
}

export interface WeeklySeries {
  team: Team;
  /** Cumulative points through each week; index i pairs with weeks[i]. */
  totals: number[];
}

export interface WeeklyStandings {
  /** Week axis, starting at 0 (pre-season, everyone at zero). */
  weeks: number[];
  series: WeeklySeries[];
  maxTotal: number;
}

/** Cumulative team totals per week — the standings-over-time chart data. */
export function standingsByWeek(state: LeagueState): WeeklyStandings {
  const rules = ruleMap(state.rules);
  const teamByHg: Record<string, string> = {};
  for (const p of state.picks) teamByHg[p.houseguestId] = p.teamId;

  const lastEventWeek = state.events.reduce((m, e) => Math.max(m, e.week), 0);
  const maxWeek = Math.max(1, state.currentWeek, lastEventWeek);
  const weeks = Array.from({ length: maxWeek + 1 }, (_, i) => i);

  // Points earned by each team in each week, then accumulated.
  const perWeek: Record<string, number[]> = {};
  for (const t of state.teams) perWeek[t.id] = weeks.map(() => 0);
  for (const e of state.events) {
    const teamId = teamByHg[e.houseguestId];
    const rule = rules[e.ruleId];
    if (!teamId || !rule || !perWeek[teamId]) continue;
    const w = Math.min(Math.max(1, e.week), maxWeek);
    perWeek[teamId][w] += rule.points;
  }

  let maxTotal = 0;
  const series: WeeklySeries[] = state.teams.map((team) => {
    let sum = 0;
    const totals = perWeek[team.id].map((pts) => {
      sum += pts;
      maxTotal = Math.max(maxTotal, sum);
      return sum;
    });
    return { team, totals };
  });
  return { weeks, series, maxTotal };
}

/** Houseguests that have not yet been drafted. */
export function undraftedHouseguests(state: LeagueState): Houseguest[] {
  const drafted = new Set(state.picks.map((p) => p.houseguestId));
  return state.houseguests.filter((h) => !drafted.has(h.id));
}

/**
 * Snake-draft order. Returns the sequence of teamIds for every pick slot.
 * Round 1: teams in order, Round 2: reversed, and so on.
 */
export function snakeOrder(teams: Team[], picksPerTeam: number): string[] {
  const order: string[] = [];
  for (let round = 0; round < picksPerTeam; round++) {
    const roundTeams = round % 2 === 0 ? teams : [...teams].reverse();
    for (const t of roundTeams) order.push(t.id);
  }
  return order;
}

/** Which team is on the clock given current picks, or null if draft is complete. */
export function teamOnTheClock(state: LeagueState): {
  teamId: string | null;
  round: number;
  overall: number;
  complete: boolean;
} {
  const order = snakeOrder(state.teams, state.picksPerTeam);
  const made = state.picks.length;
  if (made >= order.length) {
    return { teamId: null, round: state.picksPerTeam, overall: made, complete: true };
  }
  return {
    teamId: order[made],
    round: Math.floor(made / state.teams.length) + 1,
    overall: made + 1,
    complete: false,
  };
}
