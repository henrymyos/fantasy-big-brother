"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { fetchSeason, nameKeys, type WikiSeason } from "@/lib/wiki";
import {
  Button,
  Card,
  EmptyState,
  Input,
  SectionTitle,
  StatusBadge,
} from "./ui";

const CURRENT_SEASON = 28; // 2026 season — update once Wikipedia has the page.

export function SyncPanel() {
  const { state, importCastFromWiki, applyWikiSync } = useStore();
  const [input, setInput] = useState(
    `Big Brother ${CURRENT_SEASON} (American season)`,
  );
  const [season, setSeason] = useState<WikiSeason | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  const fetchNow = useCallback(async (): Promise<WikiSeason | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSeason(inputRef.current);
      setSeason(data);
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-sync loop: refetch + apply while the toggle is on.
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const run = async () => {
      const data = await fetchNow();
      if (data && !cancelled) {
        applyWikiSync(data);
        setLastSynced(new Date().toLocaleTimeString());
      }
    };
    run();
    const id = setInterval(run, 10 * 60 * 1000); // every 10 minutes
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  // Match preview against the current roster.
  const matchInfo = season
    ? (() => {
        const keys = new Set(
          state.houseguests.flatMap((h) => nameKeys(h.name)),
        );
        let matched = 0;
        for (const c of season.cast) {
          if (nameKeys(c.name).some((k) => keys.has(k))) matched++;
        }
        return { matched, total: season.cast.length };
      })()
    : null;

  const importCast = () => {
    if (season) importCastFromWiki(season.cast.map((c) => c.name));
  };
  const syncResults = () => {
    if (season) {
      applyWikiSync(season);
      setLastSynced(new Date().toLocaleTimeString());
    }
  };
  const importAndSync = () => {
    if (!season) return;
    importCastFromWiki(season.cast.map((c) => c.name));
    applyWikiSync(season);
    setLastSynced(new Date().toLocaleTimeString());
  };

  const evictedCount = season?.cast.filter((c) => c.status === "evicted")
    .length;

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle
          title="Auto-sync from Wikipedia"
          subtitle="Pull the official cast and results straight from the season's Wikipedia page — updated by fans within hours of each episode."
        />
        <div className="flex gap-2 flex-wrap items-end">
          <label className="text-xs text-[var(--muted)] flex-1 min-w-[260px]">
            Season page, number, or Wikipedia URL
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Big Brother 28 (American season)"
              className="mt-1"
              onKeyDown={(e) => e.key === "Enter" && fetchNow()}
            />
          </label>
          <Button variant="primary" onClick={fetchNow} disabled={loading}>
            {loading ? "Fetching…" : "Fetch season"}
          </Button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Tip: enter just a number (e.g. <code>28</code>) for the US season, or
          paste any season&apos;s Wikipedia URL.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/15 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </Card>

      {season && (
        <>
          <Card>
            <SectionTitle
              title={season.title}
              subtitle={
                season.premiere
                  ? `Premiered ${season.premiere}`
                  : "Season data"
              }
              right={
                <a
                  href={season.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-accent hover:underline"
                >
                  View on Wikipedia ↗
                </a>
              }
            />
            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              <Stat label="Cast" value={String(season.cast.length)} />
              <Stat label="Evicted so far" value={String(evictedCount ?? 0)} />
              <Stat
                label="Winner"
                value={season.winner ?? "TBD"}
                highlight={Boolean(season.winner)}
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Stat label="HOH wins logged" value={String(season.hohWins.length)} />
              <Stat label="Veto wins logged" value={String(season.vetoWins.length)} />
              <Stat
                label="Other comp wins"
                value={String(season.otherCompWins.length)}
              />
            </div>

            {matchInfo && (
              <p className="text-xs text-[var(--muted)] mt-4">
                {matchInfo.matched} of {matchInfo.total} cast members match
                houseguests already in your league.
              </p>
            )}

            <div className="flex gap-2 flex-wrap mt-5 pt-4 border-t border-[var(--border)]">
              <Button variant="primary" onClick={importAndSync}>
                Import cast &amp; sync everything
              </Button>
              <Button variant="ghost" onClick={importCast}>
                Import cast only
              </Button>
              <Button variant="ghost" onClick={syncResults}>
                Sync results only
              </Button>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                Keep in sync automatically (every 10 min while this tab is open)
              </label>
              {lastSynced && (
                <span className="text-xs text-[var(--muted)]">
                  Last synced {lastSynced}
                </span>
              )}
            </div>
          </Card>

          {/* Cast preview */}
          <Card>
            <SectionTitle
              title="Cast & results preview"
              subtitle="Exactly what will be applied when you sync."
            />
            {season.cast.length === 0 ? (
              <EmptyState>
                No cast table found yet — it may not be published.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {season.cast.map((c) => {
                  const hoh = season.hohWins.filter((n) =>
                    sameName(n, c.name),
                  ).length;
                  const veto = season.vetoWins.filter((n) =>
                    sameName(n, c.name),
                  ).length;
                  return (
                    <li
                      key={c.name}
                      className="flex items-center gap-3 py-2 text-sm flex-wrap"
                    >
                      <span className="flex-1 min-w-0 font-medium truncate">
                        {c.name}
                      </span>
                      {hoh > 0 && (
                        <span className="text-xs text-[var(--muted)]">
                          {hoh}× HOH
                        </span>
                      )}
                      {veto > 0 && (
                        <span className="text-xs text-[var(--muted)]">
                          {veto}× Veto
                        </span>
                      )}
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-[var(--muted)] w-14 text-right">
                        {c.day ? `Day ${c.day}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function sameName(a: string, b: string): boolean {
  const ka = new Set(nameKeys(a));
  return nameKeys(b).some((k) => ka.has(k));
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div
        className={`text-lg font-semibold truncate ${
          highlight ? "text-yellow-200" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
