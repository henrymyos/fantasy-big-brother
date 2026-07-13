import { samePerson } from "./wiki";

/** Kalshi win-the-season probability, matched to houseguests by name. */
export interface WinOdds {
  name: string;
  pct: number;
}

let cache: Promise<WinOdds[]> | null = null;

export function fetchWinOdds(): Promise<WinOdds[]> {
  cache ??= fetch("/api/odds")
    .then((r) => (r.ok ? r.json() : { odds: [] }))
    .then((d: { odds?: WinOdds[] }) => d.odds ?? [])
    .catch(() => {
      cache = null; // let a later visit retry
      return [];
    });
  return cache;
}

export function oddsFor(odds: WinOdds[], name: string): number | null {
  return odds.find((o) => samePerson(o.name, name))?.pct ?? null;
}
