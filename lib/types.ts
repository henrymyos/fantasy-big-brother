export type HouseguestStatus =
  | "active"
  | "jury"
  | "evicted"
  | "runnerup"
  | "winner";

export interface Houseguest {
  id: string;
  name: string;
  age?: string;
  hometown?: string;
  status: HouseguestStatus;
  /** Week number the houseguest left the game (eviction / finale). */
  exitWeek?: number | null;
  /**
   * Cast photo from the Big Brother fandom wiki. Unset until a lookup
   * succeeds; misses are retried on a later visit (new houseguests get
   * their fan-wiki page days into the season).
   */
  photoUrl?: string | null;
}

export interface Team {
  id: string;
  /** The family member's name — teams are people, no separate team name. */
  name: string;
  /** Tailwind-friendly hex accent color. */
  color: string;
}

export interface DraftPick {
  id: string;
  teamId: string;
  houseguestId: string;
  round: number;
  /** Overall pick number across the whole draft (1-indexed). */
  overall: number;
}

export type RuleCategory =
  | "comp"
  | "social"
  | "survival"
  | "milestone"
  | "penalty";

export interface ScoringRule {
  id: string;
  label: string;
  points: number;
  category: RuleCategory;
  description?: string;
}

export interface ScoreEvent {
  id: string;
  week: number;
  houseguestId: string;
  ruleId: string;
  note?: string;
  /** "wiki" events come from a Wikipedia sync and are replaced on each sync. */
  source?: "wiki";
}

/** One gate-locked capture of Kalshi's win-the-season market. */
export interface OddsSnapshot {
  gateKey: number;
  takenAt: number;
  list: { name: string; pct: number }[];
}

export interface LeagueState {
  seasonName: string;
  currentWeek: number;
  /**
   * Spoiler shield: houseguest ids hidden until their TV reveal. The sync
   * keeps their data in state, but the UI hides them and their events.
   */
  hidden: string[];
  /**
   * Spoiler gate: how far the family has watched. Results after this point
   * stay hidden even though the sync has them. null = no gate, show all.
   * stage: 0 = week not aired · 1 = HOH · 2 = veto & comps · 3 = full week.
   * The view advances this automatically one day after each episode airs
   * (lib/schedule.ts); the stored value acts as a manual floor.
   */
  revealed: { week: number; stage: number } | null;
  /**
   * Kalshi win-odds snapshot, refreshed only when the spoiler gate advances
   * so the numbers never leak what happens in the next episode. `prev` is
   * the snapshot this one replaced, kept for movement arrows.
   */
  odds?: (OddsSnapshot & { prev?: OddsSnapshot | null }) | null;
  teamCount: number;
  picksPerTeam: number;
  houseguests: Houseguest[];
  teams: Team[];
  picks: DraftPick[];
  rules: ScoringRule[];
  events: ScoreEvent[];
}
