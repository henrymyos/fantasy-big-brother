"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { defaultRules } from "@/lib/defaults";
import type { ScoringRule } from "@/lib/types";
import { Button } from "./ui";

/** Rules the Wikipedia sync actually awards; the rest never fire. */
const AUTO_IDS = new Set([
  "r-hoh",
  "r-pov",
  "r-comp",
  "r-survive-week",
  "r-jury",
  "r-final3",
  "r-runnerup",
  "r-winner",
  "r-afp",
]);

function RuleRow({
  rule,
  onChange,
}: {
  rule: ScoringRule;
  onChange: (points: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex-1 min-w-0 text-sm truncate" title={rule.description}>
        {rule.label}
      </span>
      <input
        type="number"
        value={rule.points}
        min={-99}
        max={99}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(-99, Math.min(99, v)));
        }}
        className="w-20 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1.5 text-sm text-right font-mono tabular-nums outline-none focus:border-accent"
        aria-label={`Points for ${rule.label}`}
      />
    </li>
  );
}

const GATE_STAGES = [
  { value: 0, label: "Nothing from this week yet" },
  { value: 1, label: "HOH winner revealed" },
  { value: 2, label: "Veto & other comps revealed" },
  { value: 3, label: "Whole week — eviction included" },
];

export function ScoringSettings({ onClose }: { onClose: () => void }) {
  const { state, updateRule, setRevealed } = useStore();
  const gate = state.revealed;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const auto = state.rules.filter((r) => AUTO_IDS.has(r.id));
  const dormant = state.rules.filter((r) => !AUTO_IDS.has(r.id));
  const defaults = defaultRules();
  const isDefault = state.rules.every(
    (r) => defaults.find((d) => d.id === r.id)?.points === r.points,
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Scoring settings"
    >
      <div
        className="card w-full max-w-md max-h-[85dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Scoring settings
            </h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Point changes apply to the whole family and recalculate every
              score, past and future.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-7 rounded-lg grid place-items-center text-[var(--muted)] hover:text-foreground hover:bg-[var(--surface-2)] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {/* Spoiler gate */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 mb-4">
            <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">
              📺 Watched through
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Advances by itself one day after each episode airs. Set it
              further ahead if you watched live; it never goes backwards past
              the auto-schedule.
            </p>
            <div className="flex items-center gap-3 mt-2.5">
              <label className="flex items-center gap-2 text-sm">
                Week
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={gate?.week ?? 1}
                  disabled={!gate}
                  onChange={(e) =>
                    gate &&
                    setRevealed({
                      week: Number(e.target.value),
                      stage: gate.stage,
                    })
                  }
                  className="w-16 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-sm text-right font-mono tabular-nums outline-none focus:border-accent disabled:opacity-40"
                />
              </label>
            </div>
            <div className="space-y-1 mt-2">
              {GATE_STAGES.map((s) => (
                <label
                  key={s.value}
                  className={`flex items-center gap-2 text-xs rounded-lg border px-2.5 py-1.5 cursor-pointer transition ${
                    gate?.stage === s.value
                      ? "border-accent bg-accent/10"
                      : "border-[var(--border)] hover:bg-[var(--surface)]"
                  } ${!gate ? "opacity-40 pointer-events-none" : ""}`}
                >
                  <input
                    type="radio"
                    name="gate-stage"
                    className="accent-[var(--accent)]"
                    checked={gate?.stage === s.value}
                    disabled={!gate}
                    onChange={() =>
                      gate && setRevealed({ week: gate.week, stage: s.value })
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer mt-2.5">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={!gate}
                onChange={(e) =>
                  setRevealed(
                    e.target.checked
                      ? null
                      : { week: state.currentWeek, stage: 3 },
                  )
                }
              />
              No gate — show everything as soon as it syncs
            </label>
          </div>

          <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide pt-1">
            Scored automatically
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {auto.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onChange={(points) => updateRule(rule.id, { points })}
              />
            ))}
          </ul>

          {dormant.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide pt-4">
                Not auto-detected
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Wikipedia doesn&apos;t report these, so they never score in
                this league.
              </p>
              <ul className="divide-y divide-[var(--border)] opacity-60">
                {dormant.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onChange={(points) => updateRule(rule.id, { points })}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 pt-3 border-t border-[var(--border)]">
          <Button
            variant="ghost"
            size="sm"
            disabled={isDefault}
            onClick={() => {
              for (const d of defaults) updateRule(d.id, { points: d.points });
            }}
          >
            Restore defaults
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
