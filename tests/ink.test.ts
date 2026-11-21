import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, readableInk } from "../lib/ink";
import { TEAM_COLORS } from "../lib/defaults";

test("every default team color and a custom pick read at 4.5:1 on both card surfaces", () => {
  for (const c of [...TEAM_COLORS, "#be38f3", "#000000"]) {
    const ink = readableInk(c);
    assert.ok(contrast(ink, "#1b2440") >= 4.5, `${c} -> ${ink}`);
    assert.ok(contrast(ink, "#131a2e") >= 4.5, `${c} -> ${ink}`);
  }
});

test("colors that already pass are untouched; non-hex passes through", () => {
  assert.equal(readableInk("#38bdf8"), "#38bdf8");
  assert.equal(readableInk("rebeccapurple"), "rebeccapurple");
});
