/**
 * BB28 air schedule → automatic spoiler-gate advancement, one day after
 * each episode airs (time to watch, then results flow in on their own).
 *
 * Episode cadence after premiere week: Sunday 8pm ET (HOH + noms),
 * Wednesday 8pm ET (veto), Thursday 9pm ET (live eviction). Times are
 * encoded in UTC (EDT = UTC-4). If CBS shuffles a week (double eviction,
 * special), the family can always advance the gate by hand — the view
 * uses whichever of manual/auto is further along.
 */

export interface Gate {
  week: number;
  stage: number;
}

const DAY = 86_400_000;
const at = (y: number, mo: number, d: number, h: number): number =>
  Date.UTC(y, mo - 1, d, h);

function buildSchedule(): { t: number; gate: Gate }[] {
  const list: { t: number; gate: Gate }[] = [
    // Week 1 (episodes 3–5; the premiere pair revealed nothing gated).
    { t: at(2026, 7, 13, 0) + DAY, gate: { week: 1, stage: 1 } }, // Sun 7/12 ep
    { t: at(2026, 7, 16, 0) + DAY, gate: { week: 1, stage: 2 } }, // Wed 7/15 ep
    { t: at(2026, 7, 17, 1) + DAY, gate: { week: 1, stage: 3 } }, // Thu 7/16 ep
  ];
  // Weeks 2+ repeat weekly from Sun 7/19, Wed 7/22, Thu 7/23.
  for (let w = 2; w <= 15; w++) {
    const off = (w - 2) * 7 * DAY;
    list.push({ t: at(2026, 7, 20, 0) + off + DAY, gate: { week: w, stage: 1 } });
    list.push({ t: at(2026, 7, 23, 0) + off + DAY, gate: { week: w, stage: 2 } });
    list.push({ t: at(2026, 7, 24, 1) + off + DAY, gate: { week: w, stage: 3 } });
  }
  return list;
}

const REVEALS = buildSchedule();

/**
 * How late in a week's episodes each synced result airs. Only HOH (Sunday)
 * and veto (Wednesday) have a predictable episode; any other comp — twist
 * comps, safety comps — can air in the Thursday live show, so those hold
 * for the full-week reveal rather than risk leaking a day early.
 */
const EVENT_STAGE: Record<string, number> = {
  "r-hoh": 1,
  "r-pov": 2,
};
export const eventStage = (ruleId: string): number =>
  EVENT_STAGE[ruleId] ?? 3;

/** What each gate stage unlocks, for user-facing copy. */
export const STAGE_LABEL: Record<number, string> = {
  1: "HOH results",
  2: "veto results",
  3: "eviction & comp results",
};

export interface UpcomingReveal {
  gate: Gate;
  /** When the episode airs. */
  airsAt: number;
  /** When its results unlock in the app (air + 1 day). */
  revealsAt: number;
}

/** The first scheduled reveal beyond the given gate, or null at season end. */
export function nextRevealAfter(g: Gate | null): UpcomingReveal | null {
  const k = gateKey(g);
  for (const r of REVEALS) {
    if (r.gate.week * 10 + r.gate.stage > k) {
      return { gate: r.gate, airsAt: r.t - DAY, revealsAt: r.t };
    }
  }
  return null;
}

/**
 * When the episode behind a gate aired: the schedule entry matching the
 * gate exactly, else the latest one at or before it (a manual gate can sit
 * on stage 0 or past the season's end). Null before any episode airs.
 */
export function airTimeForGate(g: Gate | null): number | null {
  if (!g) return null;
  const k = gateKey(g);
  let found: number | null = null;
  for (const r of REVEALS) {
    if (r.gate.week * 10 + r.gate.stage <= k) found = r.t - DAY;
    else break;
  }
  return found;
}

/** The furthest gate whose reveal moment (air + 1 day) has passed. */
export function autoGate(now: number): Gate | null {
  let gate: Gate | null = null;
  for (const r of REVEALS) {
    if (now >= r.t) gate = r.gate;
    else break;
  }
  return gate;
}

/** Comparable scalar for gates; higher = more revealed. */
export const gateKey = (g: Gate | null): number =>
  g ? g.week * 10 + g.stage : 0;

export function maxGate(a: Gate | null, b: Gate | null): Gate | null {
  return gateKey(a) >= gateKey(b) ? a : b;
}
