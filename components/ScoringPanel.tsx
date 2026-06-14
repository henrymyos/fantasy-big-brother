"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORY_META } from "@/lib/defaults";
import type { RuleCategory } from "@/lib/types";
import {
  Button,
  Card,
  CategoryTag,
  EmptyState,
  Input,
  Points,
  SectionTitle,
  Select,
} from "./ui";

const CATEGORIES = Object.keys(CATEGORY_META) as RuleCategory[];

export function ScoringPanel() {
  const {
    state,
    setCurrentWeek,
    addEvent,
    removeEvent,
    addRule,
    updateRule,
    removeRule,
  } = useStore();

  const [eHg, setEHg] = useState("");
  const [eRule, setERule] = useState("");
  const [eWeek, setEWeek] = useState(state.currentWeek);

  const [nLabel, setNLabel] = useState("");
  const [nPoints, setNPoints] = useState(5);
  const [nCat, setNCat] = useState<RuleCategory>("comp");

  const ruleById = useMemo(
    () => Object.fromEntries(state.rules.map((r) => [r.id, r])),
    [state.rules],
  );
  const hgById = useMemo(
    () => Object.fromEntries(state.houseguests.map((h) => [h.id, h])),
    [state.houseguests],
  );

  const sortedEvents = useMemo(
    () => [...state.events].sort((a, b) => b.week - a.week),
    [state.events],
  );

  const logEvent = () => {
    if (!eHg || !eRule) return;
    addEvent({ houseguestId: eHg, ruleId: eRule, week: eWeek });
  };

  const createRule = () => {
    if (!nLabel.trim()) return;
    addRule({ label: nLabel.trim(), points: nPoints, category: nCat });
    setNLabel("");
    setNPoints(5);
  };

  return (
    <div className="space-y-5">
      {/* Week + log event */}
      <Card>
        <SectionTitle
          title="Log a scoring event"
          subtitle="Record what happened each week. Points roll up to houseguests and their teams."
          right={
            <label className="text-xs text-[var(--muted)] flex items-center gap-2">
              Current week
              <Input
                type="number"
                min={1}
                value={state.currentWeek}
                onChange={(e) => {
                  setCurrentWeek(Number(e.target.value));
                  setEWeek(Number(e.target.value));
                }}
                className="w-20"
              />
            </label>
          }
        />
        <div className="grid sm:grid-cols-[1fr_1.4fr_auto_auto] gap-3 items-end">
          <label className="text-xs text-[var(--muted)]">
            Houseguest
            <Select
              value={eHg}
              onChange={(e) => setEHg(e.target.value)}
              className="mt-1"
            >
              <option value="">Select…</option>
              {state.houseguests.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-[var(--muted)]">
            Event
            <Select
              value={eRule}
              onChange={(e) => setERule(e.target.value)}
              className="mt-1"
            >
              <option value="">Select…</option>
              {state.rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.points > 0 ? "+" : ""}
                  {r.points})
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs text-[var(--muted)]">
            Week
            <Input
              type="number"
              min={1}
              value={eWeek}
              onChange={(e) => setEWeek(Number(e.target.value))}
              className="w-20 mt-1"
            />
          </label>
          <Button
            variant="primary"
            onClick={logEvent}
            disabled={!eHg || !eRule}
          >
            Log it
          </Button>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Event history */}
        <Card>
          <SectionTitle
            title="Event history"
            subtitle={`${state.events.length} events logged`}
          />
          {sortedEvents.length === 0 ? (
            <EmptyState>No events yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--border)] max-h-[520px] overflow-auto">
              {sortedEvents.map((ev) => {
                const rule = ruleById[ev.ruleId];
                const hg = hgById[ev.houseguestId];
                return (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span className="shrink-0 text-xs font-mono text-[var(--muted)] w-12">
                      Wk {ev.week}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {hg?.name ?? "Unknown"}
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">
                        {rule?.label ?? "Deleted rule"}
                      </div>
                    </div>
                    <Points value={rule?.points ?? 0} />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeEvent(ev.id)}
                    >
                      ✕
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Rules editor */}
        <Card>
          <SectionTitle
            title="Scoring rules"
            subtitle="Tune point values for your house. Changes recalculate everything."
          />
          <ul className="space-y-2 max-h-[420px] overflow-auto pr-1 mb-4">
            {state.rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
              >
                <input
                  value={rule.label}
                  onChange={(e) =>
                    updateRule(rule.id, { label: e.target.value })
                  }
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none focus:underline"
                />
                <CategoryTag category={rule.category} />
                <input
                  type="number"
                  value={rule.points}
                  onChange={(e) =>
                    updateRule(rule.id, { points: Number(e.target.value) })
                  }
                  className="w-16 rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-sm text-center font-mono outline-none focus:border-accent"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeRule(rule.id)}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs font-medium text-[var(--muted)] mb-2">
              Add a custom rule
            </p>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <Input
                value={nLabel}
                onChange={(e) => setNLabel(e.target.value)}
                placeholder="e.g. Wins a Battle Back"
              />
              <input
                type="number"
                value={nPoints}
                onChange={(e) => setNPoints(Number(e.target.value))}
                className="w-16 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2 py-2 text-sm text-center font-mono outline-none focus:border-accent"
              />
              <Select
                value={nCat}
                onChange={(e) => setNCat(e.target.value as RuleCategory)}
                className="w-auto"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={createRule}
              disabled={!nLabel.trim()}
              className="mt-2"
            >
              Add rule
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
