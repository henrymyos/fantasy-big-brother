/**
 * Cast photos from the Big Brother fandom wiki (bigbrother.fandom.com).
 *
 * Like Wikipedia, fandom exposes the MediaWiki API with CORS enabled
 * (origin=*), so this runs entirely client-side: search for the houseguest's
 * page, take its lead image thumbnail. Every houseguest across all US/CA/CBB
 * seasons has a page there with a cast photo.
 */

const FANDOM_API = "https://bigbrother.fandom.com/api.php";
const THUMB_SIZE = 400;

interface SearchPage {
  title: string;
  index: number;
  thumbnail?: { source: string };
}

/** Search text for a houseguest: drop a quoted nickname, collapse spaces. */
function searchName(name: string): string {
  return name.replace(/["'“”][^"'“”]*["'“”]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Does a wiki page title plausibly belong to this houseguest? Requires the
 * last name plus the first name or nickname, so a search for a sample name
 * like "Alex" can't latch onto an arbitrary page.
 */
function titleMatches(name: string, title: string): boolean {
  const t = title.toLowerCase();
  const tokens = searchName(name).toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  const nick = name.match(/["'“”]([^"'“”]+)["'“”]/)?.[1]?.toLowerCase();
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return t.includes(last) && (t.includes(first) || (!!nick && t.includes(nick)));
}

/**
 * Find a houseguest's cast photo. Returns a thumbnail URL, null when no
 * confidently-matching page (or no image) exists, or undefined on a transient
 * failure (offline, rate-limited) so the caller knows not to record a miss.
 * Never throws.
 */
export async function fetchHouseguestPhoto(
  name: string,
): Promise<string | null | undefined> {
  const query = searchName(name);
  if (query.split(/\s+/).length < 2) return null; // too vague to trust a match

  const api = new URL(FANDOM_API);
  api.searchParams.set("action", "query");
  api.searchParams.set("generator", "search");
  api.searchParams.set("gsrsearch", query);
  api.searchParams.set("gsrlimit", "5");
  api.searchParams.set("prop", "pageimages");
  api.searchParams.set("piprop", "thumbnail");
  api.searchParams.set("pithumbsize", String(THUMB_SIZE));
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  api.searchParams.set("origin", "*");

  try {
    const res = await fetch(api.toString());
    if (!res.ok) return undefined;
    const json = await res.json();
    const pages: SearchPage[] = json?.query?.pages ?? [];
    const hit = [...pages]
      .sort((a, b) => a.index - b.index)
      .find((p) => p.thumbnail?.source && titleMatches(name, p.title));
    return hit?.thumbnail?.source ?? null;
  } catch {
    return undefined; // transient — retry on a later visit
  }
}
