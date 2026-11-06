import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeStandings,
  snakeOrder,
  standingsByWeek,
  teamOnTheClock,
  undraftedHouseguests,
} from "../lib/scoring";
import type { LeagueState } from "../lib/types";

const team = (id: string) => ({ id, name: id, color: "#000" });
const hg = (id: string, status = "active") =>
  ({ id, name: id, status }) as LeagueState["houseguests"][number];
const pick = (teamId: string, houseguestId: string, overall: number) => ({
  id: `p${overall}`,
  teamId,
  houseguestId,
  round: 1,
  overall,
});
const ev = (houseguestId: string, ruleId: string, week: number) => ({
  id: `${houseguestId}-${ruleId}-${week}`,
  houseguestId,
  ruleId,
  week,
});

function league(over: Partial<LeagueState> = {}): LeagueState {
  return {
    seasonName: "test",
    currentWeek: 2,
    hidden: [],
    revealed: null,
    teamCount: 3,
    picksPerTeam: 1,
    houseguests: [hg("a"), hg("b"), hg("c", "evicted"), hg("d")],
    teams: [team("t1"), team("t2"), team("t3")],
    picks: [pick("t1", "a", 1), pick("t2", "b", 2), pick("t3", "c", 3)],
    rules: [
      { id: "hoh", label: "HOH", points: 10, category: "comp" },
      { id: "veto", label: "Veto", points: 5, category: "comp" },
    ] as LeagueState["rules"],
    events: [],
    ...over,
  } as LeagueState;
}

test("snakeOrder reverses every other round", () => {
  assert.deepEqual(snakeOrder([team("x"), team("y"), team("z")], 3), [
    "x", "y", "z", "z", "y", "x", "x", "y", "z",
  ]);
});

test("teamOnTheClock walks the snake and reports completion", () => {
  const s = league({ picksPerTeam: 2, picks: [pick("t1", "a", 1), pick("t2", "b", 2), pick("t3", "c", 3)] });
  assert.deepEqual(teamOnTheClock(s), { teamId: "t3", round: 2, overall: 4, complete: false });
  const done = league(); // 3 teams × 1 pick, all made
  assert.equal(teamOnTheClock(done).complete, true);
  assert.equal(teamOnTheClock(done).teamId, null);
});

test("computeStandings sums points, skips unknown rules, dense-ranks ties", () => {
  const s = league({
    events: [ev("a", "hoh", 1), ev("b", "veto", 1), ev("b", "veto", 2), ev("c", "gone", 1)],
  });
  const st = computeStandings(s);
  assert.deepEqual(
    st.map((x) => [x.team.id, x.points, x.rank]),
    [["t1", 10, 1], ["t2", 10, 1], ["t3", 0, 3]],
  );
  assert.equal(st.find((x) => x.team.id === "t3")!.activeCount, 0);
  assert.equal(st[0].houseguests[0].eventCount, 1);
});

test("standingsByWeek accumulates and clamps week 0 events into week 1", () => {
  const s = league({ events: [ev("a", "hoh", 0), ev("a", "veto", 2), ev("b", "hoh", 3)] });
  const w = standingsByWeek(s);
  assert.deepEqual(w.weeks, [0, 1, 2, 3]);
  assert.deepEqual(w.series[0].totals, [0, 10, 15, 15]);
  assert.deepEqual(w.series[1].totals, [0, 0, 0, 10]);
  assert.equal(w.maxTotal, 15);
});

test("undraftedHouseguests lists only unpicked houseguests", () => {
  assert.deepEqual(undraftedHouseguests(league()).map((h) => h.id), ["d"]);
});
