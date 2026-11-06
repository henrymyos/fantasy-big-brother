import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayName,
  nameKeys,
  parseJurySize,
  resolveSeasonTitle,
  samePerson,
  weekFromDay,
} from "../lib/wiki";

test("samePerson matches mid-season renames but not different people", () => {
  assert.ok(samePerson("Rick Devens", 'Patrick "Rick" Devens'));
  assert.ok(samePerson("LaTrice Verrett", "La Trice Verrett"));
  assert.ok(!samePerson("Rick Devens", "Rick Smith"));
  assert.ok(!samePerson("Ann Lee", "Bob Lee"));
});

test("nameKeys includes the quoted nickname and each token", () => {
  const keys = nameKeys('Cliffton "Will" Williams');
  for (const k of ["will", "cliffton", "williams"]) assert.ok(keys.includes(k), k);
});

test("displayName prefers nickname, drops surname and its particles", () => {
  assert.equal(displayName('Kamuela "Kamu" Kirk'), "Kamu");
  assert.equal(displayName("La Trice Verrett"), "La Trice");
  assert.equal(displayName("Jason De Puy"), "Jason");
  assert.equal(displayName("Rick Devens"), "Devens");
  assert.equal(displayName("Cher"), "Cher");
});

test("weekFromDay maps eviction day to a week, never below 1", () => {
  assert.equal(weekFromDay(null), null);
  assert.equal(weekFromDay(3), 1);
  assert.equal(weekFromDay(17), 2);
});

test("resolveSeasonTitle accepts a number, URL or title", () => {
  assert.equal(resolveSeasonTitle(" 27 "), "Big Brother 27 (American season)");
  assert.equal(
    resolveSeasonTitle("https://en.wikipedia.org/wiki/Big_Brother_26_(American_season)#Cast"),
    "Big Brother 26 (American season)",
  );
});

test("parseJurySize reads words or digits and rejects silly sizes", () => {
  assert.equal(parseJurySize("The last seven evicted HouseGuests comprise the Jury."), 7);
  assert.equal(parseJurySize("the last 9 evicted houseguests form the jury"), 9);
  assert.equal(parseJurySize("the last 40 evicted houseguests form the jury"), null);
  assert.equal(parseJurySize("no jury here"), null);
});
