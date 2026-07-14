"use client";

import { useStore } from "@/lib/store";
import { nextRevealAfter, STAGE_LABEL } from "@/lib/schedule";

/**
 * Slim strip answering "when does the site update next?" — the first
 * scheduled reveal beyond what the family has watched. Derived from the
 * effective gate, so a manual fast-forward skips straight to the reveal
 * after it.
 */
export function NextReveal() {
  const { state } = useStore();
  if (!state.revealed) return null; // gate off — results show as they sync
  const next = nextRevealAfter(state.revealed);
  if (!next) return null;

  const fmt = (t: number) =>
    new Date(t).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
    });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-2.5 flex items-center gap-2.5 text-sm">
      <span className="text-base shrink-0" aria-hidden>
        ⏳
      </span>
      {/* Local-time text differs from the build server's timezone. */}
      <span className="min-w-0" suppressHydrationWarning>
        <span className="font-semibold">
          Week {next.gate.week} {STAGE_LABEL[next.gate.stage]}
        </span>
        <span className="text-[var(--muted)]">
          {" "}
          — airs {fmt(next.airsAt)}, unlocks here {fmt(next.revealsAt)}
        </span>
      </span>
    </div>
  );
}
