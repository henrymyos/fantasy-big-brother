"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { eventStage, gateKey } from "@/lib/schedule";
import { displayName } from "@/lib/wiki";
import { Button, Card } from "./ui";

/**
 * "Since you last checked" — a dismissable digest of everything that
 * unlocked after this device's last visit. Per-device (localStorage), so
 * each family member catches up at their own pace. Reads only the gated
 * view, so it can never surface something unaired.
 */

const SEEN_KEY = "fbb:seen-gate:v1";

const emptySubscribe = () => () => {};

function readSeen(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSeen(key: number): void {
  try {
    window.localStorage.setItem(SEEN_KEY, String(key));
  } catch {
    // private mode — the digest just shows again next time
  }
}

const LINE_META: Record<string, { emoji: string; verb: string }> = {
  "r-hoh": { emoji: "👑", verb: "won Head of Household" },
  "r-pov": { emoji: "🛡️", verb: "took the Power of Veto" },
  "r-comp": { emoji: "🎯", verb: "won a competition" },
};

export function CatchUpDigest() {
  const { state } = useStore();
  // False during prerender/hydration, true after mount — localStorage-driven
  // UI can't render on the server without a hydration mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [seen] = useState(readSeen);
  const [dismissed, setDismissed] = useState(false);

  const currentKey = gateKey(state.revealed);

  // First visit on this device: mark everything seen quietly — a digest of
  // the entire season so far would just be noise.
  useEffect(() => {
    if (mounted && currentKey > 0 && seen === null) writeSeen(currentKey);
  }, [mounted, currentKey, seen]);

  if (!mounted || dismissed || currentKey === 0) return null;
  if (seen === null || seen >= currentKey) return null;

  const stageOf = (week: number, stage: number) => week * 10 + stage;
  const inWindow = (k: number) => k > seen && k <= currentKey;

  const events = state.events
    .filter((e) => inWindow(stageOf(e.week, eventStage(e.ruleId))))
    .sort(
      (a, b) =>
        stageOf(a.week, eventStage(a.ruleId)) -
        stageOf(b.week, eventStage(b.ruleId)),
    );
  // Gate may open before the next wiki sync delivers the results — wait for
  // real content instead of burning the window on an empty card.
  if (events.length === 0) return null;

  const hgById = new Map(state.houseguests.map((h) => [h.id, h]));
  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );
  const who = (hgId: string): string | null => {
    const hg = hgById.get(hgId);
    if (!hg) return null;
    const team = teamByHg.get(hgId);
    return team
      ? `${displayName(hg.name)} (${team.name})`
      : displayName(hg.name);
  };

  const lines: string[] = [];
  for (const e of events) {
    const meta = LINE_META[e.ruleId];
    if (!meta) continue; // survival/jury points show in the totals below
    const name = who(e.houseguestId);
    if (name) lines.push(`${meta.emoji} ${name} ${meta.verb} (week ${e.week}).`);
  }
  for (const h of state.houseguests) {
    if (
      (h.status === "evicted" || h.status === "jury") &&
      h.exitWeek != null &&
      inWindow(stageOf(h.exitWeek, 3))
    ) {
      lines.push(
        `🚪 ${who(h.id) ?? displayName(h.name)} was evicted (week ${h.exitWeek}).`,
      );
    }
  }

  // Points each team picked up from the newly unlocked events.
  const rules = new Map(state.rules.map((r) => [r.id, r]));
  const delta = new Map(state.teams.map((t) => [t.id, 0]));
  for (const e of events) {
    const team = teamByHg.get(e.houseguestId);
    if (!team) continue;
    delta.set(team.id, (delta.get(team.id) ?? 0) + (rules.get(e.ruleId)?.points ?? 0));
  }

  const dismiss = () => {
    writeSeen(currentKey);
    setDismissed(true);
  };

  return (
    <Card className="border-accent/40 bg-accent/5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          📬 Since you last checked
        </h2>
        <Button size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
      {lines.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 text-sm">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {state.teams.map((t) => {
          const d = delta.get(t.id) ?? 0;
          return (
            <span key={t.id} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2 rounded-full inline-block"
                style={{ background: t.color }}
              />
              {t.name}
              <span
                className={`font-mono font-semibold tabular-nums ${
                  d > 0 ? "text-emerald-300" : "text-[var(--muted)]"
                }`}
              >
                {d > 0 ? `+${d}` : d}
              </span>
            </span>
          );
        })}
      </div>
    </Card>
  );
}
