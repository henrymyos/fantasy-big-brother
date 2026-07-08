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

/**
 * The single family league. No accounts, no invites: every client reads and
 * writes this one well-known row, and realtime keeps all devices in sync.
 */
export const FAMILY_LEAGUE_ID = "00000000-0000-4000-8000-000000000028";
