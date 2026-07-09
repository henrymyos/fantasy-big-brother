import type { LeagueState, ScoringRule, Team } from "./types";

// Also the standings-chart series palette: every hue passes the lightness,
// chroma, colorblind-separation and contrast checks against the card surface
// (#131a2e), including between neighbors in this order.
export const TEAM_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#d97706", // amber
  "#16a34a", // green
  "#ec4899", // pink
  "#a855f7", // purple
  "#0d9488", // teal
  "#ea580c", // orange
];

export function defaultRules(): ScoringRule[] {
  return [
    {
      id: "r-hoh",
      label: "Win Head of Household",
      points: 10,
      category: "comp",
      description: "Becomes HOH for the week.",
    },
    {
      id: "r-pov",
      label: "Win Power of Veto",
      points: 8,
      category: "comp",
      description: "Wins the golden POV.",
    },
    {
      id: "r-comp",
      label: "Win other competition",
      points: 4,
      category: "comp",
      description: "Safety, luxury, BB Battleback, etc.",
    },
    {
      id: "r-power",
      label: "Win a special power / America's vote",
      points: 6,
      category: "social",
      description: "Secret power, fan-voted advantage, etc.",
    },
    {
      id: "r-veto-saved",
      label: "Saved off the block by veto",
      points: 4,
      category: "social",
    },
    {
      id: "r-survive-block",
      label: "Survive eviction while nominated",
      points: 5,
      category: "survival",
      description: "Was on the block but not evicted.",
    },
    {
      id: "r-survive-week",
      label: "Survive the week",
      points: 2,
      category: "survival",
      description: "Still in the house at the end of the week.",
    },
    {
      id: "r-jury",
      label: "Make it to Jury",
      points: 5,
      category: "milestone",
    },
    {
      id: "r-final3",
      label: "Reach Final 3",
      points: 10,
      category: "milestone",
    },
    {
      id: "r-runnerup",
      label: "Runner-up (Final 2)",
      points: 20,
      category: "milestone",
    },
    {
      id: "r-winner",
      label: "Win Big Brother",
      points: 40,
      category: "milestone",
    },
    {
      id: "r-afp",
      label: "America's Favorite Player",
      points: 10,
      category: "milestone",
    },
    {
      id: "r-self-evict",
      label: "Self-evict / expelled",
      points: -10,
      category: "penalty",
    },
  ];
}

export function defaultTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    owner: "",
    color: TEAM_COLORS[i % TEAM_COLORS.length],
  }));
}

export function defaultState(): LeagueState {
  const teamCount = 4;
  return {
    seasonName: "Big Brother 28 Family League",
    currentWeek: 1,
    teamCount,
    picksPerTeam: 4,
    houseguests: [],
    teams: defaultTeams(teamCount),
    picks: [],
    rules: defaultRules(),
    events: [],
  };
}
