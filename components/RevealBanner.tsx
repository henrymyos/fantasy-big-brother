"use client";

import { useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { gateKey, revealedAtForGate, STAGE_LABEL } from "@/lib/schedule";

/**
 * Reveal-night flair: for a day after fresh results unlock, a banner at the
 * top of the standings celebrates them. Dismissing it (per device) remembers
 * the gate, so it only ever greets genuinely new results.
 */

const FRESH_FOR = 24 * 60 * 60 * 1000;
const SEEN_KEY = "bb-reveal-seen";

function subscribeClock(cb: () => void): () => void {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
const clockNow = () => Math.floor(Date.now() / 30_000);
const clockServer = () => 0;

export function RevealBanner() {
  const { state } = useStore();
  const bucket = useSyncExternalStore(subscribeClock, clockNow, clockServer);
  const [dismissed, setDismissed] = useState(0);

  if (bucket === 0) return null; // server render / first hydration frame
  const gate = state.revealed;
  if (!gate || gate.stage === 0) return null;
  const revealedAt = revealedAtForGate(gate);
  if (revealedAt === null) return null;

  const now = bucket * 30_000;
  if (now < revealedAt || now - revealedAt > FRESH_FOR) return null;

  const key = gateKey(gate);
  const seen = Math.max(
    dismissed,
    Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0,
  );
  if (seen >= key) return null;

  return (
    <div className="rounded-xl border border-accent/40 bg-gradient-to-r from-accent/15 to-transparent px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0" aria-hidden>
        ✨
      </span>
      <p className="text-sm min-w-0 flex-1">
        <span className="font-semibold">
          Week {gate.week} {STAGE_LABEL[gate.stage]} just unlocked
        </span>
        <span className="text-[var(--muted)]">
          {" "}
          — the week card below has the story.
        </span>
      </p>
      <button
        onClick={() => {
          localStorage.setItem(SEEN_KEY, String(key));
          setDismissed(key);
        }}
        aria-label="Dismiss"
        className="shrink-0 size-7 rounded-lg grid place-items-center text-[var(--muted)] hover:text-foreground hover:bg-[var(--surface-2)] transition cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
