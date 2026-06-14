"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaultState, defaultTeams, TEAM_COLORS } from "./defaults";
import { snakeOrder, teamOnTheClock } from "./scoring";
import { nameKeys, weekFromDay, type WikiSeason } from "./wiki";
import {
  isSupabaseConfigured,
  LEAGUES_TABLE,
  parseLeagueId,
  supabase,
} from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  DraftPick,
  Houseguest,
  HouseguestStatus,
  LeagueState,
  ScoreEvent,
  ScoringRule,
  Team,
} from "./types";

/** Map a sync concept onto a scoring rule (by id, falling back to label). */
const RULE_CONCEPTS: Record<string, { id: string; re: RegExp }> = {
  hoh: { id: "r-hoh", re: /head of household|\bhoh\b/i },
  veto: { id: "r-pov", re: /veto|\bpov\b/i },
  comp: { id: "r-comp", re: /other competition|block ?buster|safety|arena/i },
  winner: { id: "r-winner", re: /win(?:s)? big brother|^winner/i },
  runnerup: { id: "r-runnerup", re: /runner-?up|final 2/i },
  afp: { id: "r-afp", re: /favou?rite/i },
};

function resolveRuleId(rules: ScoringRule[], concept: string): string | null {
  const c = RULE_CONCEPTS[concept];
  if (!c) return null;
  if (rules.some((r) => r.id === c.id)) return c.id;
  return rules.find((r) => c.re.test(r.label))?.id ?? null;
}

const STORAGE_KEY = "fbb:league:v1";
const LEAGUE_KEY = "fbb:leagueId";

export type SyncStatus = "local" | "connecting" | "online" | "saving" | "error";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

interface StoreValue {
  state: LeagueState;
  loaded: boolean;
  // meta
  setSeasonName: (name: string) => void;
  setCurrentWeek: (week: number) => void;
  setLeagueShape: (teamCount: number, picksPerTeam: number) => void;
  // houseguests
  addHouseguests: (names: string[]) => void;
  updateHouseguest: (id: string, patch: Partial<Houseguest>) => void;
  setHouseguestStatus: (
    id: string,
    status: HouseguestStatus,
    exitWeek?: number | null,
  ) => void;
  removeHouseguest: (id: string) => void;
  // teams
  updateTeam: (id: string, patch: Partial<Team>) => void;
  // draft
  draftHouseguest: (houseguestId: string, teamId?: string) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  // rules
  addRule: (rule: Omit<ScoringRule, "id">) => void;
  updateRule: (id: string, patch: Partial<ScoringRule>) => void;
  removeRule: (id: string) => void;
  // events
  addEvent: (event: Omit<ScoreEvent, "id">) => void;
  removeEvent: (id: string) => void;
  // wikipedia sync
  importCastFromWiki: (names: string[]) => void;
  applyWikiSync: (season: WikiSeason) => void;
  // shared-league (supabase) sync
  supabaseEnabled: boolean;
  leagueId: string | null;
  syncStatus: SyncStatus;
  createSharedLeague: () => Promise<void>;
  joinLeague: (input: string) => Promise<boolean>;
  leaveSharedLeague: () => void;
  // data management
  replaceState: (next: LeagueState) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function migrate(parsed: Partial<LeagueState>): LeagueState {
  const base = defaultState();
  return {
    ...base,
    ...parsed,
    teams: parsed.teams?.length ? parsed.teams : base.teams,
    rules: parsed.rules?.length ? parsed.rules : base.rules,
    houseguests: parsed.houseguests ?? [],
    picks: parsed.picks ?? [],
    events: parsed.events ?? [],
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LeagueState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");

  // JSON of the last state written-to or read-from the server, used to break
  // the realtime echo loop (don't re-save what we just received, and ignore
  // realtime events for our own writes).
  const lastSyncedJson = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUrl = useCallback((id: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("league", id);
      else url.searchParams.delete("league");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, []);

  // Subscribe to realtime changes for a league row.
  const subscribeToLeague = useCallback((id: string) => {
    if (!supabase) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`league:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: LEAGUES_TABLE,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as { state?: LeagueState } | null;
          if (!row?.state) return;
          const incoming = JSON.stringify(row.state);
          if (incoming === lastSyncedJson.current) return; // our own echo
          lastSyncedJson.current = incoming;
          setState(migrate(row.state));
        },
      )
      .subscribe();
  }, []);

  // Load a league row from the server and start syncing it.
  const loadLeague = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false;
      setSyncStatus("connecting");
      const { data, error } = await supabase
        .from(LEAGUES_TABLE)
        .select("state")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        setSyncStatus("error");
        return false;
      }
      lastSyncedJson.current = JSON.stringify(data.state);
      setState(migrate(data.state as LeagueState));
      setLeagueId(id);
      try {
        localStorage.setItem(LEAGUE_KEY, id);
      } catch {
        // ignore
      }
      subscribeToLeague(id);
      setSyncStatus("online");
      return true;
    },
    [subscribeToLeague],
  );

  // Initial load: hydrate from local cache, then connect to a shared league
  // if one is referenced by the URL or remembered locally.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setState(migrate(JSON.parse(raw)));
      } catch {
        // ignore corrupt cache
      }
      let id: string | null = null;
      try {
        id =
          new URLSearchParams(window.location.search).get("league") ||
          localStorage.getItem(LEAGUE_KEY);
      } catch {
        // ignore
      }
      if (supabase && id) {
        await loadLeague(id);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
      if (channelRef.current && supabase)
        supabase.removeChannel(channelRef.current);
    };
  }, [loadLeague]);

  // Persist: always cache locally; debounce-push to the server when online.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
    if (!supabase || !leagueId) return;
    const sb = supabase;
    const json = JSON.stringify(state);
    if (json === lastSyncedJson.current) return; // unchanged / inbound echo

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = setTimeout(async () => {
      lastSyncedJson.current = json;
      const { error } = await sb
        .from(LEAGUES_TABLE)
        .update({ state, updated_at: new Date().toISOString() })
        .eq("id", leagueId);
      setSyncStatus(error ? "error" : "online");
    }, 600);
  }, [state, loaded, leagueId]);

  const value = useMemo<StoreValue>(() => {
    const setSeasonName = (name: string) =>
      setState((s) => ({ ...s, seasonName: name }));

    const setCurrentWeek = (week: number) =>
      setState((s) => ({ ...s, currentWeek: Math.max(1, week) }));

    const setLeagueShape = (teamCount: number, picksPerTeam: number) =>
      setState((s) => {
        const tc = Math.max(2, Math.min(8, teamCount));
        const ppt = Math.max(1, Math.min(8, picksPerTeam));
        let teams = s.teams.slice(0, tc);
        if (teams.length < tc) {
          const extra = defaultTeams(tc).slice(teams.length).map((t, i) => ({
            ...t,
            color: TEAM_COLORS[(teams.length + i) % TEAM_COLORS.length],
          }));
          teams = [...teams, ...extra];
        }
        const keptTeamIds = new Set(teams.map((t) => t.id));
        const picks = s.picks.filter((p) => keptTeamIds.has(p.teamId));
        return { ...s, teamCount: tc, picksPerTeam: ppt, teams, picks };
      });

    const addHouseguests = (names: string[]) =>
      setState((s) => {
        const cleaned = names
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        const additions: Houseguest[] = cleaned.map((name) => ({
          id: uid("hg"),
          name,
          status: "active",
          exitWeek: null,
        }));
        return { ...s, houseguests: [...s.houseguests, ...additions] };
      });

    const updateHouseguest = (id: string, patch: Partial<Houseguest>) =>
      setState((s) => ({
        ...s,
        houseguests: s.houseguests.map((h) =>
          h.id === id ? { ...h, ...patch } : h,
        ),
      }));

    const setHouseguestStatus = (
      id: string,
      status: HouseguestStatus,
      exitWeek?: number | null,
    ) =>
      setState((s) => ({
        ...s,
        houseguests: s.houseguests.map((h) =>
          h.id === id
            ? {
                ...h,
                status,
                exitWeek:
                  status === "active"
                    ? null
                    : exitWeek ?? h.exitWeek ?? s.currentWeek,
              }
            : h,
        ),
      }));

    const removeHouseguest = (id: string) =>
      setState((s) => ({
        ...s,
        houseguests: s.houseguests.filter((h) => h.id !== id),
        picks: s.picks.filter((p) => p.houseguestId !== id),
        events: s.events.filter((e) => e.houseguestId !== id),
      }));

    const updateTeam = (id: string, patch: Partial<Team>) =>
      setState((s) => ({
        ...s,
        teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));

    const draftHouseguest = (houseguestId: string, teamId?: string) =>
      setState((s) => {
        if (s.picks.some((p) => p.houseguestId === houseguestId)) return s;
        const clock = teamOnTheClock(s);
        const targetTeam = teamId ?? clock.teamId;
        if (!targetTeam) return s;
        const overall = s.picks.length + 1;
        const round = Math.floor(s.picks.length / s.teams.length) + 1;
        const pick: DraftPick = {
          id: uid("pick"),
          teamId: targetTeam,
          houseguestId,
          round,
          overall,
        };
        return { ...s, picks: [...s.picks, pick] };
      });

    const undoLastPick = () =>
      setState((s) => ({ ...s, picks: s.picks.slice(0, -1) }));

    const resetDraft = () => setState((s) => ({ ...s, picks: [] }));

    const addRule = (rule: Omit<ScoringRule, "id">) =>
      setState((s) => ({
        ...s,
        rules: [...s.rules, { ...rule, id: uid("r") }],
      }));

    const updateRule = (id: string, patch: Partial<ScoringRule>) =>
      setState((s) => ({
        ...s,
        rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));

    const removeRule = (id: string) =>
      setState((s) => ({
        ...s,
        rules: s.rules.filter((r) => r.id !== id),
        events: s.events.filter((e) => e.ruleId !== id),
      }));

    const addEvent = (event: Omit<ScoreEvent, "id">) =>
      setState((s) => ({
        ...s,
        events: [...s.events, { ...event, id: uid("ev") }],
      }));

    const removeEvent = (id: string) =>
      setState((s) => ({
        ...s,
        events: s.events.filter((e) => e.id !== id),
      }));

    const importCastFromWiki = (names: string[]) =>
      setState((s) => {
        const existing = new Set(
          s.houseguests.map((h) => h.name.toLowerCase().trim()),
        );
        const additions: Houseguest[] = names
          .map((n) => n.trim())
          .filter((n) => n && !existing.has(n.toLowerCase()))
          .map((name) => ({
            id: uid("hg"),
            name,
            status: "active" as HouseguestStatus,
            exitWeek: null,
          }));
        return { ...s, houseguests: [...s.houseguests, ...additions] };
      });

    const applyWikiSync = (season: WikiSeason) =>
      setState((s) => {
        // Build a key → houseguest index for fuzzy first-name matching.
        const index: Record<string, string> = {};
        for (const hg of s.houseguests) {
          for (const k of nameKeys(hg.name)) {
            if (!(k in index)) index[k] = hg.id;
          }
        }
        const matchId = (name: string): string | null => {
          for (const k of nameKeys(name)) if (index[k]) return index[k];
          return null;
        };

        // Apply statuses from the cast table.
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
        const houseguests = s.houseguests.map((h) =>
          statusById[h.id] ? { ...h, ...statusById[h.id] } : h,
        );

        // Rebuild wiki-sourced scoring events (idempotent re-sync).
        const manual = s.events.filter((e) => e.source !== "wiki");
        const wikiEvents: ScoreEvent[] = [];
        const push = (name: string, concept: string, week: number) => {
          const id = matchId(name);
          if (!id) return;
          const ruleId = resolveRuleId(s.rules, concept);
          if (!ruleId) return;
          wikiEvents.push({
            id: uid("ev"),
            houseguestId: id,
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

        return {
          ...s,
          houseguests,
          events: [...manual, ...wikiEvents],
          currentWeek: Math.max(s.currentWeek, season.hohWins.length || 1),
        };
      });

    const createSharedLeague = async () => {
      if (!supabase) return;
      setSyncStatus("connecting");
      const { data, error } = await supabase
        .from(LEAGUES_TABLE)
        .insert({ name: state.seasonName, state })
        .select("id")
        .single();
      if (error || !data) {
        setSyncStatus("error");
        return;
      }
      lastSyncedJson.current = JSON.stringify(state);
      setLeagueId(data.id);
      try {
        localStorage.setItem(LEAGUE_KEY, data.id);
      } catch {
        // ignore
      }
      updateUrl(data.id);
      subscribeToLeague(data.id);
      setSyncStatus("online");
    };

    const joinLeague = async (input: string): Promise<boolean> => {
      const id = parseLeagueId(input);
      if (!id || !supabase) return false;
      const ok = await loadLeague(id);
      if (ok) updateUrl(id);
      return ok;
    };

    const leaveSharedLeague = () => {
      if (channelRef.current && supabase)
        supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      lastSyncedJson.current = null;
      setLeagueId(null);
      try {
        localStorage.removeItem(LEAGUE_KEY);
      } catch {
        // ignore
      }
      updateUrl(null);
      setSyncStatus("local");
    };

    const replaceState = (next: LeagueState) => setState(migrate(next));

    const resetAll = () => setState(defaultState());

    return {
      state,
      loaded,
      setSeasonName,
      setCurrentWeek,
      setLeagueShape,
      addHouseguests,
      updateHouseguest,
      setHouseguestStatus,
      removeHouseguest,
      updateTeam,
      draftHouseguest,
      undoLastPick,
      resetDraft,
      addRule,
      updateRule,
      removeRule,
      addEvent,
      removeEvent,
      importCastFromWiki,
      applyWikiSync,
      supabaseEnabled: isSupabaseConfigured,
      leagueId,
      syncStatus,
      createSharedLeague,
      joinLeague,
      leaveSharedLeague,
      replaceState,
      resetAll,
    };
  }, [state, loaded, leagueId, syncStatus, loadLeague, subscribeToLeague, updateUrl]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { snakeOrder };
