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
