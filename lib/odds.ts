import { samePerson } from "./wiki";

/**
 * Kalshi win-the-season odds. The numbers live in the shared league state
 * as a gate-locked snapshot (see app/api/refresh-odds); clients only ping
 * the refresh route when they notice the snapshot is behind the gate.
 */
export interface WinOdds {
  name: string;
  pct: number;
}

let pinged = false;

/** Ask the server to refresh the snapshot (no-op unless the gate moved). */
export function pingOddsRefresh(): void {
  if (pinged) return;
  pinged = true;
  fetch("/api/refresh-odds").catch(() => {
    pinged = false; // transient — allow a later retry
  });
}

export function oddsFor(odds: WinOdds[], name: string): number | null {
  return odds.find((o) => samePerson(o.name, name))?.pct ?? null;
}
