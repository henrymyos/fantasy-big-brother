import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Returns null when env vars are missing so the app
 * gracefully falls back to local-only (localStorage) mode — e.g. during local
 * dev before the backend is configured.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);

export const LEAGUES_TABLE = "bb_leagues";

/** Pull a league id out of a raw input (a bare id or a full share URL). */
export function parseLeagueId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("league");
    if (fromQuery) return fromQuery;
  } catch {
    // not a URL — fall through
  }
  const uuid = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return uuid ? uuid[0] : trimmed;
}
