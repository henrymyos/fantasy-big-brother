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
   * Cast photo from the Big Brother fandom wiki. undefined = not looked up
   * yet, null = looked up and none found (don't retry).
   */
  photoUrl?: string | null;
}

export interface Team {
  id: string;
  name: string;
  owner: string;
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

export interface LeagueState {
  seasonName: string;
  currentWeek: number;
  teamCount: number;
  picksPerTeam: number;
  houseguests: Houseguest[];
  teams: Team[];
  picks: DraftPick[];
  rules: ScoringRule[];
  events: ScoreEvent[];
}
