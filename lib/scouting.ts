import { samePerson } from "./wiki";

/**
 * Pre-season scouting: projected fantasy-point finish for every houseguest,
 * with a short read on their game. Written after the premiere using only
 * aired episode-1 information and cast bios — no live-feed spoilers.
 *
 * Fantasy points historically split ~40% comp wins / ~35% survival /
 * ~25% milestones, so the ranking rewards comp ability first, then staying
 * power, then finale odds.
 */
export interface ScoutReport {
  name: string;
  rank: number;
  blurb: string;
  strengths: string[];
  weaknesses: string[];
}

const REPORTS: ScoutReport[] = [
  {
    name: 'Kamuela "Kamu" Kirk',
    rank: 1,
    blurb:
      "A 32-year-old MMA fighter is exactly what HOH and Veto walls are built for. If he keeps the temperature low socially, he can win comps at a pace nobody else in this cast can match — and comp wins are the biggest points engine in this scoring.",
    strengths: [
      "Elite physical comps",
      "Endurance and grip challenges",
      "Competitor's discipline",
    ],
    weaknesses: [
      "Obvious first big-threat target",
      "Fight instinct can read as intimidating",
    ],
  },
  {
    name: "Rick Devens",
    rank: 2,
    blurb:
      "A proven reality-TV challenge machine with a broadcaster's charm — he wins comps AND cameras love him, which puts America's Favorite in play. The risk is that everyone in the house knows exactly who he is.",
    strengths: [
      "Proven challenge winner",
      "Instantly likable on TV — AFP threat",
      "Handles pressure on camera for a living",
    ],
    weaknesses: [
      "Walking résumé — permanent target",
      "42 in a young endurance field",
    ],
  },
  {
    name: 'Jack "Rome" Seymour',
    rank: 3,
    blurb:
      "The pickleball coach already banked a safety-challenge win on premiere night, and coaching is a social superpower in this house. Athletic enough to win, disarming enough to not get clipped for it.",
    strengths: [
      "Won a premiere safety challenge",
      "Athlete's reflexes and touch",
      "Coach energy — people follow him",
    ],
    weaknesses: [
      "Early shine draws early attention",
      "Untested at strategy under pressure",
    ],
  },
  {
    name: "Barrett Pfeiffer",
    rank: 4,
    blurb:
      "Jumbotron engineer is a sneaky-perfect Big Brother résumé: technical brain for puzzles, young legs for endurance. This is the classic comp-winner archetype that quietly stacks points into jury.",
    strengths: [
      "Puzzle and build comps",
      "Endurance-ready at 27",
      "Reads as harmless early",
    ],
    weaknesses: [
      "Engineers can over-engineer the social game",
      "Ceiling depends on finding allies fast",
    ],
  },
  {
    name: "Chuk Anyanwu",
    rank: 5,
    blurb:
      "Won a safety challenge on premiere night and analyzes supply chains for a living — athletic AND systematic. That combination usually converts to a deep run with comp wins sprinkled through it.",
    strengths: [
      "Won a premiere safety challenge",
      "Analytical planner",
      "Big social presence",
    ],
    weaknesses: [
      "Big personality can fill up a room",
      "Must dodge the early-threat label",
    ],
  },
  {
    name: "Mallory Aurichio",
    rank: 6,
    blurb:
      "An actual rocket scientist who will be chronically underestimated. Mental comps, memory walls, and precision puzzles are where she banks points while bigger targets take the heat.",
    strengths: [
      "Mental and puzzle comps",
      "Underestimated — low early target risk",
      "Methodical under pressure",
    ],
    weaknesses: [
      "Pure-physical comps are a gap",
      "Quiet starts can drift into floater territory",
    ],
  },
  {
    name: 'Dianelys "Dee" Valladares',
    rank: 7,
    blurb:
      "The premiere's teased mystery legend — a Survivor champion. Winners of other shows arrive with elite instincts and a giant bullseye in equal measure; if the house lets her settle in, she scores in every category.",
    strengths: [
      "Champion-level game instincts",
      "Comfortable in chaos and twists",
      "Social charm that wins juries",
    ],
    weaknesses: [
      "The résumé is the target",
      "Joined a house that bonded without her",
    ],
  },
  {
    name: "Drew Campbell",
    rank: 8,
    blurb:
      "The youngest houseguest with a surgical dental assistant's steady hands — precision comps and stamina are his lanes. The question at 22 is whether the social game wobbles before the points pile up.",
    strengths: [
      "Youth and stamina",
      "Steady hands for precision comps",
      "Low-profile résumé",
    ],
    weaknesses: [
      "Youngest players get played",
      "Unproven social read",
    ],
  },
  {
    name: "Melody Morris",
    rank: 9,
    blurb:
      "A corporate game show host — she performs, she banters, and she's absorbed a thousand trivia formats. Days, dates, and memory comps are real point sources, and hosts know how to be liked.",
    strengths: [
      "Trivia and memory comps",
      "Camera-ready social game",
      "Reads a room professionally",
    ],
    weaknesses: [
      "Performer polish can read as fake",
      "Physical comps unproven",
    ],
  },
  {
    name: "Lyric Medeiros",
    rank: 10,
    blurb:
      "An attorney who argues for a living will never lose a campaign week. That's survival points deep into jury even if the comp wins are occasional — and lawyers tend to peak in the endgame.",
    strengths: [
      "Persuasion when nominated",
      "Strategic endgame thinking",
      "Composure in confrontations",
    ],
    weaknesses: [
      "Lawyer label spooks houses",
      "Modest comp ceiling",
    ],
  },
  {
    name: "Haley Thogmartin",
    rank: 11,
    blurb:
      "A telemedicine executive who manages people and crises for a living. The profile of a quiet operator who's still there in week 9 — steady survival and jury points, with the odd clutch comp.",
    strengths: [
      "Operator's social management",
      "Calm in high-stakes weeks",
      "Deep-run staying power",
    ],
    weaknesses: [
      "Rarely the comp favorite",
      "Boss energy can rub players wrong",
    ],
  },
  {
    name: "Taylor Brown",
    rank: 12,
    blurb:
      "School counselors are professionally impossible to hate — that's the social glue archetype that survives forever. The fantasy catch: gluey players rack survival points but rarely win comps.",
    strengths: [
      "Everyone's confidant",
      "Long survival runway",
      "Conflict de-escalation",
    ],
    weaknesses: [
      "Low comp-win ceiling",
      "Glue players get cut at final stretch",
    ],
  },
  {
    name: "Jason De Puy",
    rank: 13,
    blurb:
      "Salina EsTitties comes in with premiere-night proof (a safety-challenge win) and the biggest entertainment factor in the cast — a genuine America's Favorite threat. Comps beyond that are the question mark.",
    strengths: [
      "Won a premiere safety challenge",
      "Star power — AFP magnet",
      "Fearless social swings",
    ],
    weaknesses: [
      "Celebrity résumé attracts votes",
      "Physical comp profile unclear",
    ],
  },
  {
    name: "Yash Patel",
    rank: 14,
    blurb:
      "A quiet finance analyst who'll fly under the radar while louder players collide. That's real survival value, but under-the-radar rarely converts to the comp wins that top fantasy boards.",
    strengths: [
      "Low target profile",
      "Numbers brain for strategy comps",
      "Patient game",
    ],
    weaknesses: [
      "Invisible players earn invisible points",
      "May never take a big swing",
    ],
  },
  {
    name: "Ashley Trail",
    rank: 15,
    blurb:
      "A Chicago bartender who has read drunk strangers for years — the social instincts are real. The fantasy profile is scrappy survival with an upset comp here or there.",
    strengths: [
      "Street-smart people reads",
      "Scrappy and adaptable",
      "Blends into the pack early",
    ],
    weaknesses: [
      "No obvious comp lane",
      "Needs an alliance to carry her deep",
    ],
  },
  {
    name: "Angela Murray",
    rank: 16,
    blurb:
      "The BB26 returnee can absolutely win comps — she proved it — but returning players wear a bullseye from day one, and her famously combustible style makes quiet weeks unlikely. High variance, low floor.",
    strengths: [
      "Proven comp winner (BB26)",
      "Knows the house rhythms",
      "Fearless",
    ],
    weaknesses: [
      "Returnee target from minute one",
      "Combustible — creates her own danger",
    ],
  },
  {
    name: "La Trice Verrett",
    rank: 17,
    blurb:
      "At 57 she'll be the house mom everyone adores, and houses often carry their mom deep — that's quiet survival and even jury points. But in a scoring system that pays comp winners first, the ceiling is the lowest on the board.",
    strengths: [
      "Universally likable — nobody's target",
      "Carried-deep potential",
      "Life-experience social reads",
    ],
    weaknesses: [
      "Toughest comp profile in the cast",
      "Points depend entirely on longevity",
    ],
  },
];

export const SCOUTING_TOTAL = REPORTS.length;

/** Find a houseguest's report, tolerant of Wikipedia name variants. */
export function scoutFor(name: string): ScoutReport | null {
  return REPORTS.find((r) => samePerson(r.name, name)) ?? null;
}
