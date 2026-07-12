"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "./ui";

export const STAGES = [
  { value: 0, label: "Nothing from this week yet" },
  { value: 1, label: "HOH winner revealed" },
  { value: 2, label: "Veto & other comps revealed" },
  { value: 3, label: "Whole week — eviction included" },
];

/** Short label for the header button, e.g. "Wk 1 · HOH". */
export function gateLabel(
  gate: { week: number; stage: number } | null,
): string {
  if (!gate) return "All results";
  const stage = ["not aired", "HOH", "Veto", "full"][gate.stage] ?? "";
  return `Wk ${gate.week} · ${stage}`;
}

/**
 * Family-shared "watched through" control. Wikipedia syncs results from the
 * live feeds before episodes air, so the gate keeps everything newer than
 * the last watched episode hidden until someone advances it.
 */
export function SpoilerGate({ onClose }: { onClose: () => void }) {
  const { state, setRevealed } = useStore();
  const gate = state.revealed;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Spoiler gate"
    >
      <div
        className="card w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              📺 Watched through…
            </h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              Results the family hasn&apos;t seen on TV stay hidden until you
              advance this. It applies to everyone.
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

        <div className="px-5 pb-4 space-y-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Week</span>
            <input
              type="number"
              min={1}
              max={20}
              value={gate?.week ?? 1}
              disabled={!gate}
              onChange={(e) =>
                gate &&
                setRevealed({ week: Number(e.target.value), stage: gate.stage })
              }
              className="w-20 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1.5 text-sm text-right font-mono tabular-nums outline-none focus:border-accent disabled:opacity-40"
            />
          </label>

          <div className="space-y-1.5">
            {STAGES.map((s) => (
              <label
                key={s.value}
                className={`flex items-center gap-2.5 text-sm rounded-lg border px-3 py-2 cursor-pointer transition ${
                  gate?.stage === s.value
                    ? "border-accent bg-accent/10"
                    : "border-[var(--border)] hover:bg-[var(--surface-2)]"
                } ${!gate ? "opacity-40 pointer-events-none" : ""}`}
              >
                <input
                  type="radio"
                  name="stage"
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

          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
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

        <div className="flex justify-end p-5 pt-2 border-t border-[var(--border)]">
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
