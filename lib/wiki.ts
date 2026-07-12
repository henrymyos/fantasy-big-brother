import type { HouseguestStatus } from "./types";

/**
 * Pulls cast + results for a US Big Brother season from Wikipedia.
 *
 * Source of truth is the season's Wikipedia article (e.g.
 * "Big Brother 27 (American season)"), which fans keep current within hours of
 * each episode. We read the raw wikitext via the MediaWiki API (CORS-enabled,
 * so this runs entirely client-side) and parse two tables:
 *   - "HouseGuests"      → cast names + final placement (status)
 *   - "Voting history"   → weekly HOH / Veto / Block Buster competition winners
 *
 * Wikitext is messy and changes season to season, so every parser is defensive:
 * if a table is missing or malformed we return whatever we could read rather
 * than throwing.
 */

export interface WikiCastMember {
  name: string;
  status: HouseguestStatus;
  /** Day they left the game, if known (from {{Evicted|day}} etc.). */
  day: number | null;
}

export interface WikiSeason {
  title: string;
  url: string;
  premiere: string | null;
  winner: string | null;
  runnerUp: string | null;
  americasFavorite: string | null;
  cast: WikiCastMember[];
  /** One entry per competition win (a name may repeat). */
  hohWins: string[];
  vetoWins: string[];
  otherCompWins: string[];
}

/**
 * Match keys for a name so a first-name-only reference from the voting grid
 * (e.g. "Will", "Zae") can resolve to a full cast name (e.g.
 * `Cliffton "Will" Williams`). Returns lowercased full name, each token, and
 * any quoted nickname.
 */
export function nameKeys(name: string): string[] {
  const lower = name.toLowerCase().trim();
  const keys = new Set<string>();
  keys.add(lower);
  keys.add(lower.replace(/["']/g, ""));
  for (const tok of lower.split(/\s+/)) {
    const bare = tok.replace(/["']/g, "");
    if (bare) keys.add(bare);
  }
  const quoted = lower.match(/"([^"]+)"/);
  if (quoted) keys.add(quoted[1]);
  return [...keys];
}

/** Parse a display name into comparable parts. */
function nameParts(name: string): {
  nick: string | null;
  first: string;
  last: string;
  squashed: string;
} {
  const nick =
    name.match(/["'“”]([^"'“”]+)["'“”]/)?.[1]?.trim().toLowerCase() ?? null;
  const tokens = name
    .replace(/["'“”][^"'“”]*["'“”]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return {
    nick,
    first: tokens[0] ?? "",
    last: tokens[tokens.length - 1] ?? "",
    squashed: name.toLowerCase().replace(/[^a-z0-9]/g, ""),
  };
}

/**
 * Whether two display names plausibly refer to the same houseguest.
 * Wikipedia editors rename cast members mid-season ("Rick Devens" →
 * 'Patrick "Rick" Devens', "LaTrice" ↔ "La Trice"), so the sync must
 * recognize a renamed person instead of importing them twice.
 */
export function samePerson(a: string, b: string): boolean {
  const A = nameParts(a);
  const B = nameParts(b);
  if (A.squashed && A.squashed === B.squashed) return true; // spacing/punct
  if (!A.last || A.last !== B.last) return false;
  return (
    A.first === B.first ||
    A.nick === B.first ||
    B.nick === A.first ||
    (!!A.nick && A.nick === B.nick)
  );
}

/**
 * The name the show actually uses: a quoted nickname if they have one
 * ('Kamuela "Kamu" Kirk' → "Kamu"), otherwise everything but the last name
 * ("La Trice Verrett" → "La Trice").
 */
/** Surname particles, so "Jason De Puy" → "Jason" (not "Jason De"). */
const SURNAME_PARTICLES = new Set([
  "de", "del", "della", "der", "den", "da", "di", "van", "von", "la", "le",
  "dos", "du", "st", "st.",
]);

export function displayName(name: string): string {
  const nick = name.match(/["'“”]([^"'“”]+)["'“”]/)?.[1]?.trim();
  if (nick) return nick;
  const tokens = name.trim().split(/\s+/);
  if (tokens.length <= 1) return name.trim();
  let cut = tokens.length - 1; // drop the surname…
  while (cut > 1 && SURNAME_PARTICLES.has(tokens[cut - 1].toLowerCase())) {
    cut--; // …and any particles attached to it
  }
  return tokens.slice(0, cut).join(" ");
}

/** Derive an approximate week number from the day a houseguest left. */
export function weekFromDay(day: number | null): number | null {
  if (!day) return null;
  return Math.max(1, Math.round((day - 3) / 7));
}

/** Turn a number, page title, or full Wikipedia URL into a page title. */
export function resolveSeasonTitle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
  if (urlMatch) return decodeURIComponent(urlMatch[1]).replace(/_/g, " ");
  if (/^\d+$/.test(trimmed)) {
    return `Big Brother ${trimmed} (American season)`;
  }
  return trimmed;
}

async function fetchWikitext(title: string): Promise<string> {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", title);
  api.searchParams.set("prop", "wikitext");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  api.searchParams.set("redirects", "1");
  api.searchParams.set("origin", "*");

  const res = await fetch(api.toString());
  const json = await res.json();
  if (json.error) {
    if (json.error.code === "missingtitle") {
      throw new Error(
        `No Wikipedia page found for "${title}". The cast may not be announced yet — check the exact page title.`,
      );
    }
    throw new Error(json.error.info || "Wikipedia request failed.");
  }
  const text: string | undefined = json?.parse?.wikitext;
  if (!text) throw new Error("Wikipedia returned no article text.");
  return text;
}

export async function fetchSeason(input: string): Promise<WikiSeason> {
  const title = resolveSeasonTitle(input);
  // Strip HTML comments up front — editors park not-yet-official rows
  // (e.g. rumored houseguests) inside <!-- --> and those must not import.
  const wikitext = (await fetchWikitext(title)).replace(
    /<!--[\s\S]*?-->/g,
    "",
  );

  const infobox = parseInfobox(wikitext);
  const cast = parseHouseguests(wikitext);
  const comps = parseVotingHistory(wikitext);

  return {
    title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(
      title.replace(/ /g, "_"),
    )}`,
    premiere: infobox.premiere,
    winner: infobox.winner ?? cast.find((c) => c.status === "winner")?.name ?? null,
    runnerUp:
      infobox.runnerUp ?? cast.find((c) => c.status === "runnerup")?.name ?? null,
    americasFavorite: infobox.americasFavorite,
    cast,
    ...comps,
  };
}

/* ------------------------------------------------------------------ */
/* Markup helpers                                                      */
/* ------------------------------------------------------------------ */

/** Resolve value-bearing templates, drop the rest, strip wiki/HTML markup. */
function clean(input: string): string {
  let s = input;
  // strip references entirely
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  s = s.replace(/<ref[^>]*\/>/gi, "");
  // strikethrough values are overridden later in the same cell — drop them
  s = s.replace(/<s>[\s\S]*?<\/s>/gi, "");

  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(
      /\{\{sortname\|([^|{}]+)\|([^|{}]+)(?:\|[^{}]*)?\}\}/gi,
      "$1 $2",
    );
    s = s.replace(/\{\{nowrap\|([^{}]*)\}\}/gi, "$1");
    s = s.replace(/\{\{font ?color\|[^|{}]*\|([^{}]*)\}\}/gi, "$1");
    s = s.replace(/\{\{(?:runner-up|Evicted|Eliminated)\|([^{}]*)\}\}/gi, "$1");
  }
  // remove any remaining templates (efn, ref, main, legend…), innermost first
  while (/\{\{[^{}]*\}\}/.test(s)) s = s.replace(/\{\{[^{}]*\}\}/g, "");

  // wiki links [[target|label]] → label, [[target]] → target
  s = s.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]*)\]\]/g, "$1");
  // line breaks → newlines, then strip remaining html
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  // bold/italic markers
  s = s.replace(/'''?/g, "");
  return s.trim();
}

/** Content of a single table cell line, dropping leading attributes. */
function cellContent(line: string): string {
  let raw = line.replace(/^\s*[|!]+\s*/, "");
  // split off a leading attribute segment ("style=... |", 'bgcolor="x" |')
  const sep = topLevelPipe(raw);
  if (sep !== -1) {
    const left = raw.slice(0, sep);
    if (/=|bgcolor|colspan|rowspan|align|width|scope/i.test(left)) {
      raw = raw.slice(sep + 1);
    }
  }
  return clean(raw);
}

/** Index of the first "|" not inside {{…}} or [[…]], or -1. */
function topLevelPipe(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      i++;
    } else if (two === "}}" || two === "]]") {
      depth--;
      i++;
    } else if (s[i] === "|" && depth <= 0) {
      return i;
    }
  }
  return -1;
}

function sectionBody(wikitext: string, headingRegex: RegExp): string | null {
  const m = wikitext.match(headingRegex);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  const rest = wikitext.slice(start);
  const next = rest.search(/\n==[^=]/);
  return next === -1 ? rest : rest.slice(0, next);
}

/** First wikitable ({| … |}) within a chunk of wikitext. */
function firstTable(body: string): string | null {
  const start = body.indexOf("{|");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length - 1; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{|") {
      depth++;
      i++;
    } else if (two === "|}") {
      depth--;
      i++;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return body.slice(start);
}

/* ------------------------------------------------------------------ */
/* Infobox                                                            */
/* ------------------------------------------------------------------ */

function parseInfobox(wikitext: string): {
  winner: string | null;
  runnerUp: string | null;
  americasFavorite: string | null;
  premiere: string | null;
} {
  const field = (name: string): string | null => {
    const re = new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n|]+)`, "i");
    const m = wikitext.match(re);
    return m ? clean(m[1]) || null : null;
  };
  const dateField = (): string | null => {
    const m = wikitext.match(
      /first_aired\s*=\s*\{\{start date\|(\d+)\|(\d+)\|(\d+)/i,
    );
    if (!m) return null;
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  };
  // America's Favorite is conventionally label1/data1 in the infobox.
  let afp = field("data1");
  const label1 = field("label1");
  if (label1 && !/favorite|favourite/i.test(label1)) afp = null;
  return {
    winner: field("winner"),
    runnerUp: field("runner_up"),
    americasFavorite: afp,
    premiere: dateField(),
  };
}

/* ------------------------------------------------------------------ */
/* HouseGuests table                                                  */
/* ------------------------------------------------------------------ */

function parseHouseguests(wikitext: string): WikiCastMember[] {
  const body = sectionBody(wikitext, /==\s*Houseguests?\s*==/i);
  if (!body) return [];
  const table = firstTable(body);
  if (!table) return [];

  const rows = table.split(/\n\|-/);
  const cast: WikiCastMember[] = [];
  // A {{Evicted}} cell may carry a rowspan, sharing one result across the next
  // few rows (e.g. a double eviction). Carry that result forward.
  let carry: { status: HouseguestStatus; day: number | null; left: number } | null =
    null;

  for (const row of rows) {
    // The name is the row's header cell ("! …"). Early in a season these are
    // often bare (`! Ashley Trail`) with no scope attribute, so accept any
    // header cell that isn't a column header.
    const headerLine = row.split("\n").find((l) => /^\s*!/.test(l));
    if (!headerLine || /scope="col"/i.test(headerLine)) continue;

    const name = cellContent(headerLine).split("\n")[0].trim();
    if (!name || /^name$/i.test(name)) continue;

    const own = resultFromRow(row);
    let status = own.status;
    let day = own.day;

    if (own.hasResult) {
      if (own.rowspan > 1)
        carry = { status: own.status, day: own.day, left: own.rowspan - 1 };
    } else if (carry && carry.left > 0) {
      status = carry.status;
      day = carry.day;
      carry.left -= 1;
    }

    cast.push({ name, status, day });
  }
  return cast;
}

function resultFromRow(row: string): {
  status: HouseguestStatus;
  day: number | null;
  hasResult: boolean;
  rowspan: number;
} {
  const dayMatch =
    row.match(/\{\{Evicted\|(\d+)/i) || row.match(/Day\s*(\d+)/i);
  const day = dayMatch ? Number(dayMatch[1]) : null;
  const rowspanMatch = row.match(
    /rowspan="(\d+)"\s*(?:\{\{(?:Evicted|runner-up)|bgcolor[^|]*\|\s*(?:'''Winner|Eliminated))/i,
  );
  const rowspan = rowspanMatch ? Number(rowspanMatch[1]) : 1;

  if (/'''Winner'''|\bWinner\b/.test(row) && /73FB76|Winner/.test(row))
    return { status: "winner", day, hasResult: true, rowspan };
  if (/runner-up/i.test(row))
    return { status: "runnerup", day, hasResult: true, rowspan };
  if (/\{\{Evicted\||\bEvicted\b|\bEliminated\b|salmon/i.test(row))
    return { status: "evicted", day, hasResult: true, rowspan };
  return { status: "active", day, hasResult: false, rowspan: 1 };
}

/* ------------------------------------------------------------------ */
/* Voting history — competition winners                               */
/* ------------------------------------------------------------------ */

function parseVotingHistory(wikitext: string): {
  hohWins: string[];
  vetoWins: string[];
  otherCompWins: string[];
} {
  const empty = { hohWins: [], vetoWins: [], otherCompWins: [] };
  const body = sectionBody(wikitext, /==\s*Voting history\s*==/i);
  if (!body) return empty;
  const table = firstTable(body);
  if (!table) return empty;

  // Structural rows (HOH, Veto, etc.) sit above the first thick divider that
  // introduces the per-houseguest vote rows.
  const dividerIdx = table.search(/\n\|-[^\n]*border-top:\s*5px/i);
  const header = dividerIdx === -1 ? table : table.slice(0, dividerIdx);

  const chunks = header.split(/\n\|-/);
  const hohWins: string[] = [];
  const vetoWins: string[] = [];
  const otherCompWins: string[] = [];

  for (const chunk of chunks) {
    const label = rowLabel(chunk);
    if (!label) continue;
    if (/votes? to|nomination/i.test(label)) continue;

    if (/head of household/i.test(label)) {
      hohWins.push(...rowNames(chunk));
    } else if (/veto/i.test(label) && /winner/i.test(label)) {
      vetoWins.push(...rowNames(chunk));
    } else if (/winner/i.test(label)) {
      // Block Buster / AI Arena / Safety / other competition winners.
      otherCompWins.push(...rowNames(chunk));
    }
  }
  return { hohWins, vetoWins, otherCompWins };
}

/** The row's header label (the "! scope=row | …" cell). */
function rowLabel(chunk: string): string | null {
  const line = chunk.split("\n").find((l) => /^\s*!/.test(l));
  if (!line) return null;
  return cellContent(line).replace(/\n/g, " ").trim();
}

/** Every houseguest name appearing in a structural row's data cells. */
function rowNames(chunk: string): string[] {
  const lines = chunk.split("\n");
  const names: string[] = [];
  let started = false;
  for (const line of lines) {
    if (/^\s*!/.test(line)) {
      started = true; // header cell — data cells follow
      continue;
    }
    if (!started) continue;
    if (!/^\s*\|/.test(line)) continue;
    const content = cellContent(line);
    for (const piece of content.split("\n")) {
      const name = piece.trim();
      if (!name) continue;
      if (/^\(?none\)?$/i.test(name)) continue;
      if (/no vote|votes|day \d|^—$|^-$/i.test(name)) continue;
      names.push(name);
    }
  }
  return names;
}
