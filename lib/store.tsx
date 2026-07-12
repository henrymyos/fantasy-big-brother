"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaultState, defaultTeams, TEAM_COLORS } from "./defaults";
import { fetchHouseguestPhoto } from "./photos";
import { snakeOrder, teamOnTheClock } from "./scoring";
import { applyWikiSeason } from "./sync";
import { fetchSeason } from "./wiki";
import {
  FAMILY_LEAGUE_ID,
  isSupabaseConfigured,
  LEAGUES_TABLE,
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

/** The one season this app tracks; syncs from Wikipedia in the background. */
const WIKI_SEASON = "Big Brother 28 (American season)";
const WIKI_SYNC_INTERVAL_MS = 5 * 60_000;

const STORAGE_KEY = "fbb:league:v1";

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
  /** Spoiler shield: raw entries hidden from view until they air on TV. */
  hiddenHouseguests: Houseguest[];
  setHouseguestHidden: (id: string, hidden: boolean) => void;
  setRevealed: (gate: { week: number; stage: number } | null) => void;
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
  // sync
  supabaseEnabled: boolean;
  syncStatus: SyncStatus;
  wikiSyncedAt: number | null;
  wikiError: string | null;
  // data management
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
    hidden: parsed.hidden ?? [],
    revealed: parsed.revealed ?? null,
  };
}

/** How late in a week's episodes each synced result airs. */
const EVENT_STAGE: Record<string, number> = { "r-hoh": 1, "r-pov": 2, "r-comp": 2 };
const eventStage = (ruleId: string): number => EVENT_STAGE[ruleId] ?? 3;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LeagueState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [wikiSyncedAt, setWikiSyncedAt] = useState<number | null>(null);
  const [wikiError, setWikiError] = useState<string | null>(null);

  // JSON of the last state written-to or read-from the server, used to break
  // the realtime echo loop (don't re-save what we just received, and ignore
  // realtime events for our own writes).
  const lastSyncedJson = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // On mount: hydrate the local cache.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(migrate(JSON.parse(raw)));
    } catch {
      // ignore corrupt cache
    }
    setLoaded(true);
  }, []);

  // Connect to the one family league: load it (seeding the row on the very
  // first visit), then subscribe to realtime changes from other devices.
  useEffect(() => {
    if (!loaded || !supabase) return;
    const sb = supabase;
    let active = true;

    const read = async () =>
      (
        await sb
          .from(LEAGUES_TABLE)
          .select("state")
          .eq("id", FAMILY_LEAGUE_ID)
          .maybeSingle()
      ).data as { state: LeagueState } | null;

    // A tab that slept through realtime messages (phone locked, laptop lid)
    // must re-read before its next save can clobber everyone else's edits.
    const refetch = async () => {
      const row = await read();
      if (!active || !row?.state) return;
      const json = JSON.stringify(row.state);
      if (json === lastSyncedJson.current) return;
      lastSyncedJson.current = json;
      setState(migrate(row.state));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    (async () => {
      setSyncStatus("connecting");
      let row = await read();
      if (!row) {
        // First device ever: seed the shared row with whatever we have.
        // A same-moment race on another device is harmless — duplicates are
        // ignored and we re-read whichever seed won.
        await sb.from(LEAGUES_TABLE).upsert(
          {
            id: FAMILY_LEAGUE_ID,
            name: "Big Brother 28 Family League",
            state: stateRef.current,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        row = await read();
      }
      if (!active) return;
      if (!row?.state) {
        setSyncStatus("error");
        return;
      }
      lastSyncedJson.current = JSON.stringify(row.state);
      setState(migrate(row.state));

      channelRef.current = sb
        .channel("family-league")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: LEAGUES_TABLE,
            filter: `id=eq.${FAMILY_LEAGUE_ID}`,
          },
          (payload) => {
            const incoming = payload.new as { state?: LeagueState } | null;
            if (!incoming?.state) return;
            const json = JSON.stringify(incoming.state);
            if (json === lastSyncedJson.current) return; // our own echo
            lastSyncedJson.current = json;
            setState(migrate(incoming.state));
          },
        )
        .subscribe();
      setConnected(true);
      setSyncStatus("online");
    })();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (channelRef.current) sb.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [loaded]);

  // Background Wikipedia sync: on load and every few minutes, pull the season
  // and fold it in. applyWikiSeason is a no-op (same object) when Wikipedia
  // has nothing new, so idle polls cause no writes.
  useEffect(() => {
    if (!loaded) return;
    let stop = false;
    const run = async () => {
      try {
        const season = await fetchSeason(WIKI_SEASON);
        if (stop) return;
        if (season.cast.length > 0) {
          setState((s) => applyWikiSeason(s, season));
        }
        setWikiError(null);
        setWikiSyncedAt(Date.now());
      } catch (e) {
        if (!stop)
          setWikiError(e instanceof Error ? e.message : "Sync failed.");
      }
    };
    run();
    const timer = setInterval(run, WIKI_SYNC_INTERVAL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [loaded]);

  // Look up cast photos on the fandom wiki for houseguests that don't have
  // one yet. Only found URLs are recorded — a miss stays unset so someone
  // whose fan-wiki page appears mid-season (common right after premiere)
  // gets picked up on a later visit. One attempt per id+name per session.
  const photoAttempts = useRef(new Set<string>());
  const photoLoopRunning = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    const pending = state.houseguests.filter(
      (h) => !h.photoUrl && !photoAttempts.current.has(`${h.id}|${h.name}`),
    );
    if (pending.length === 0) return;
    // Debounced so mid-rename keystrokes don't each fire a lookup. Applying
    // a result re-runs this effect, so a single-flight guard keeps exactly
    // one lookup loop alive; results are always applied (the updater is a
    // no-op if the houseguest was removed or already resolved meanwhile).
    const timer = setTimeout(async () => {
      if (photoLoopRunning.current) return;
      photoLoopRunning.current = true;
      try {
        for (const hg of pending) {
          photoAttempts.current.add(`${hg.id}|${hg.name}`);
          const url = await fetchHouseguestPhoto(hg.name);
          if (!url) continue; // no page (yet) or transient — try next visit
          setState((s) => ({
            ...s,
            houseguests: s.houseguests.map((h) =>
              h.id === hg.id && !h.photoUrl ? { ...h, photoUrl: url } : h,
            ),
          }));
        }
      } finally {
        photoLoopRunning.current = false;
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [loaded, state.houseguests]);

  // Persist: always cache locally; debounce-push to the server when online.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
    if (!supabase || !connected) return;
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
        .eq("id", FAMILY_LEAGUE_ID);
      setSyncStatus(error ? "error" : "online");
    }, 600);
  }, [state, loaded, connected]);

  // Spoiler shield + gate: what consumers see. Hidden houseguests and any
  // results past the family's watched-through point are filtered out; the
  // raw state keeps everything so sync, persistence, and reveals lose
  // nothing.
  const view = useMemo<LeagueState>(() => {
    const g = state.revealed;
    if (state.hidden.length === 0 && !g) return state;
    const hid = new Set(state.hidden);
    let houseguests = state.houseguests.filter((h) => !hid.has(h.id));
    let events = state.events.filter((e) => !hid.has(e.houseguestId));
    if (g) {
      // The gate only hides synced results — manually logged events were
      // entered by the family, so they've been watched by definition.
      events = events.filter(
        (e) =>
          e.source !== "wiki" ||
          e.week < g.week ||
          (e.week === g.week && eventStage(e.ruleId) <= g.stage),
      );
      // An exit the family hasn't watched yet still shows as "in the house".
      houseguests = houseguests.map((h) =>
        h.exitWeek != null &&
        (h.exitWeek > g.week || (h.exitWeek === g.week && g.stage < 3))
          ? { ...h, status: "active" as const, exitWeek: null }
          : h,
      );
    }
    return {
      ...state,
      houseguests,
      events,
      currentWeek: g ? Math.min(state.currentWeek, g.week) : state.currentWeek,
    };
  }, [state]);

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

    const setRevealed = (gate: { week: number; stage: number } | null) =>
      setState((s) => ({
        ...s,
        revealed: gate
          ? {
              week: Math.max(1, Math.min(99, Math.round(gate.week))),
              stage: Math.max(0, Math.min(3, Math.round(gate.stage))),
            }
          : null,
      }));

    const setHouseguestHidden = (id: string, hidden: boolean) =>
      setState((s) => {
        // Never hide someone a team has drafted — the board math needs them.
        if (hidden && s.picks.some((p) => p.houseguestId === id)) return s;
        const next = hidden
          ? [...new Set([...s.hidden, id])]
          : s.hidden.filter((h) => h !== id);
        return { ...s, hidden: next };
      });

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

    const resetAll = () => setState(defaultState());

    const hid = new Set(state.hidden);
    return {
      state: view,
      loaded,
      setSeasonName,
      setCurrentWeek,
      setLeagueShape,
      addHouseguests,
      updateHouseguest,
      setHouseguestStatus,
      removeHouseguest,
      hiddenHouseguests: state.houseguests.filter((h) => hid.has(h.id)),
      setHouseguestHidden,
      setRevealed,
      updateTeam,
      draftHouseguest,
      undoLastPick,
      resetDraft,
      addRule,
      updateRule,
      removeRule,
      addEvent,
      removeEvent,
      supabaseEnabled: isSupabaseConfigured,
      syncStatus,
      wikiSyncedAt,
      wikiError,
      resetAll,
    };
  }, [state, view, loaded, syncStatus, wikiSyncedAt, wikiError]);

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
