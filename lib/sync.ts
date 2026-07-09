import { nameKeys, samePerson, weekFromDay, type WikiSeason } from "./wiki";
import type {
  Houseguest,
  HouseguestStatus,
  LeagueState,
  ScoreEvent,
  ScoringRule,
} from "./types";

/**
 * Pure league ⟵ Wikipedia merge logic. Kept out of the store so it can be
 * exercised directly (e.g. against a finished season) without React.
 */

/** Map a sync concept onto a scoring rule (by id, falling back to label). */
const RULE_CONCEPTS: Record<string, { id: string; re: RegExp }> = {
  hoh: { id: "r-hoh", re: /head of household|\bhoh\b/i },
  veto: { id: "r-pov", re: /veto|\bpov\b/i },
  comp: { id: "r-comp", re: /other competition|block ?buster|safety|arena/i },
  winner: { id: "r-winner", re: /win(?:s)? big brother|^winner/i },
  runnerup: { id: "r-runnerup", re: /runner-?up|final 2/i },
  afp: { id: "r-afp", re: /favou?rite/i },
  survive: { id: "r-survive-week", re: /survive the week/i },
  jury: { id: "r-jury", re: /jury/i },
  final3: { id: "r-final3", re: /final 3|final three/i },
};

function resolveRuleId(rules: ScoringRule[], concept: string): string | null {
  const c = RULE_CONCEPTS[concept];
  if (!c) return null;
  if (rules.some((r) => r.id === c.id)) return c.id;
  return rules.find((r) => c.re.test(r.label))?.id ?? null;
}

/**
 * Deterministic id for a wiki-imported houseguest, so every family device
 * derives the same state from the same Wikipedia data instead of fighting
 * over random ids.
 */
function hgIdForName(name: string): string {
  return (
    "hg-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
  );
}

/**
 * Fold a fetched Wikipedia season into the league: add any cast members we
 * don't have yet (recognizing renamed people), update statuses, and rebuild
 * the wiki-sourced scoring events — including the milestones Wikipedia never
 * logs directly (weekly survival, making jury, reaching the Final 3), which
 * follow from the eviction order. Fully deterministic (stable ids, stable
 * order) and returns the SAME state object when nothing changed, so a no-op
 * sync causes no re-render and no server write.
 */
export function applyWikiSeason(
  s: LeagueState,
  season: WikiSeason,
): LeagueState {
  const usedIds = new Set(s.houseguests.map((h) => h.id));
  const known = s.houseguests.map((h) => ({ id: h.id, name: h.name }));
  const renames: Record<string, string> = {};
  const additions: Houseguest[] = [];
  for (const c of season.cast) {
    const name = c.name.trim();
    if (!name) continue;
    const match = known.find((k) => samePerson(k.name, name));
    if (match) {
      // Wikipedia renamed them ("Rick Devens" → 'Patrick "Rick" Devens'):
      // follow the wiki's current spelling instead of duplicating the person.
      if (match.name !== name) renames[match.id] = name;
      continue;
    }
    const id = hgIdForName(name);
    if (usedIds.has(id)) continue; // slug collision — leave for manual entry
    usedIds.add(id);
    known.push({ id, name });
    additions.push({ id, name, status: "active", exitWeek: null });
  }
  const houseguests = [
    ...s.houseguests.map((h) =>
      renames[h.id] ? { ...h, name: renames[h.id] } : h,
    ),
    ...additions,
  ];

  // Key → houseguest index for fuzzy first-name matching (the voting grid
  // uses first names / nicknames only).
  const index: Record<string, string> = {};
  for (const hg of houseguests) {
    for (const k of nameKeys(hg.name)) {
      if (!(k in index)) index[k] = hg.id;
    }
  }
  const matchId = (name: string): string | null => {
    for (const k of nameKeys(name)) if (index[k]) return index[k];
    return null;
  };

  // Statuses from the cast table.
  const statusById: Record<
    string,
    { status: HouseguestStatus; exitWeek: number | null }
  > = {};
  for (const c of season.cast) {
    const id = matchId(c.name);
    if (!id) continue;
    statusById[id] = {
      status: c.status,
      exitWeek: c.status === "active" ? null : weekFromDay(c.day),
    };
  }
  const nextHouseguests = houseguests.map((h) =>
    statusById[h.id] ? { ...h, ...statusById[h.id] } : h,
  );

  // Rebuild wiki-sourced scoring events (idempotent re-sync).
  const manual = s.events.filter((e) => e.source !== "wiki");
  const wikiEvents: ScoreEvent[] = [];
  const seenIds = new Set<string>();
  const push = (name: string, concept: string, week: number) => {
    const hgId = matchId(name);
    if (!hgId) return;
    const ruleId = resolveRuleId(s.rules, concept);
    if (!ruleId) return;
    let id = `ev-wiki-${concept}-w${week}-${hgId}`;
    for (let n = 2; seenIds.has(id); n++) {
      id = `ev-wiki-${concept}-w${week}-${hgId}-${n}`;
    }
    seenIds.add(id);
    wikiEvents.push({
      id,
      houseguestId: hgId,
      ruleId,
      week: Math.max(1, week),
      source: "wiki",
    });
  };
  season.hohWins.forEach((n, i) => push(n, "hoh", i + 1));
  season.vetoWins.forEach((n, i) => push(n, "veto", i + 1));
  season.otherCompWins.forEach((n, i) => push(n, "comp", i + 1));
  const finaleWeek = Math.max(1, season.hohWins.length);
  if (season.winner) push(season.winner, "winner", finaleWeek);
  if (season.runnerUp) push(season.runnerUp, "runnerup", finaleWeek);
  if (season.americasFavorite)
    push(season.americasFavorite, "afp", finaleWeek);

  // Derived milestones. Jury = the final 11 (9 jurors + 2 finalists, the
  // modern US format); adjust MAKES_JURY if a twist changes the jury size.
  const MAKES_JURY = 11;
  const FINAL = 3;
  const T = season.cast.length;
  const evictions = season.cast
    .filter(
      (c) =>
        (c.status === "evicted" || c.status === "jury") && c.day !== null,
    )
    .sort((a, b) => a.day! - b.day!);
  // Latest completed week = the week of the most recent eviction.
  const lastWeek = evictions.length
    ? Math.max(...evictions.map((c) => weekFromDay(c.day) ?? 1))
    : 0;
  // Week the house first shrank to `size` people (null until it happens).
  const weekHouseHit = (size: number): number | null => {
    const ev = evictions[T - size - 1];
    return ev ? weekFromDay(ev.day) : null;
  };
  const juryWeek = weekHouseHit(MAKES_JURY);
  const finalWeek = weekHouseHit(FINAL);
  const placementOf = new Map<string, number>();
  evictions.forEach((c, i) => placementOf.set(c.name, T - i));

  if (T > 0) {
    for (const c of season.cast) {
      const stillIn =
        c.status === "active" ||
        c.status === "winner" ||
        c.status === "runnerup";
      // +2 "survive the week" for every completed week they were in the
      // house at the end of (their exit week itself doesn't count).
      const exitWeek = stillIn ? null : weekFromDay(c.day);
      const through = stillIn ? lastWeek : Math.max(0, (exitWeek ?? 1) - 1);
      for (let w = 1; w <= through; w++) push(c.name, "survive", w);

      const placement = placementOf.get(c.name);
      const madeJury = stillIn
        ? juryWeek !== null
        : placement !== undefined && placement <= MAKES_JURY;
      if (madeJury && juryWeek !== null) push(c.name, "jury", juryWeek);
      const madeFinal = stillIn
        ? finalWeek !== null
        : placement !== undefined && placement <= FINAL;
      if (madeFinal && finalWeek !== null) push(c.name, "final3", finalWeek);
    }
  }

  const next: LeagueState = {
    ...s,
    houseguests: nextHouseguests,
    events: [...manual, ...wikiEvents],
    currentWeek: Math.max(s.currentWeek, season.hohWins.length || 1),
  };
  return JSON.stringify(next) === JSON.stringify(s) ? s : next;
}
