"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { teamOnTheClock } from "@/lib/scoring";
import { Button } from "@/components/ui";
import { StandingsPanel } from "@/components/StandingsPanel";
import { DraftPanel } from "@/components/DraftPanel";

type TabId = "standings" | "draft";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "draft", label: "Draft", icon: "📋" },
  { id: "standings", label: "Standings", icon: "🏆" },
];

function statusLine(
  supabaseEnabled: boolean,
  syncStatus: string,
  wikiSyncedAt: number | null,
  wikiError: string | null,
): string {
  const shared = !supabaseEnabled
    ? "saved in this browser"
    : syncStatus === "error"
      ? "sync error — retrying"
      : syncStatus === "connecting"
        ? "connecting…"
        : "live for the whole family";
  const wiki = wikiError
    ? "Wikipedia check failed — retrying"
    : wikiSyncedAt
      ? "results auto-update from Wikipedia"
      : "checking Wikipedia…";
  return `${shared} · ${wiki}`;
}

export default function Home() {
  const {
    state,
    loaded,
    setSeasonName,
    resetAll,
    supabaseEnabled,
    syncStatus,
    wikiSyncedAt,
    wikiError,
  } = useStore();
  // Land on the draft board while the draft is live, standings after.
  // Resolved once the cached league has loaded; null = still deciding.
  const [tab, setTab] = useState<TabId | null>(null);
  useEffect(() => {
    if (!loaded) return;
    setTab((cur) => cur ?? (teamOnTheClock(state).complete ? "standings" : "draft"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial tab only
  }, [loaded]);

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-[var(--background)]/80 border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="size-9 rounded-full grid place-items-center bg-accent/15 text-xl">
            👁️
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={state.seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className="bg-transparent text-lg font-bold tracking-tight outline-none focus:underline w-full"
              aria-label="Season name"
            />
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
              <span
                className={`inline-block size-1.5 rounded-full ${
                  supabaseEnabled && syncStatus !== "error"
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              {statusLine(supabaseEnabled, syncStatus, wikiSyncedAt, wikiError)}
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "Reset the entire league — for everyone in the family? This clears teams, cast, draft and scores.",
                )
              )
                resetAll();
            }}
          >
            Reset
          </Button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  tab === t.id
                    ? "border-accent text-foreground"
                    : "border-transparent text-[var(--muted)] hover:text-foreground"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 w-full flex-1">
        {!loaded ? (
          <div className="text-center text-[var(--muted)] py-20">Loading…</div>
        ) : (
          <>
            {tab === "standings" && <StandingsPanel />}
            {tab === "draft" && <DraftPanel />}
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        Draft houseguests · results sync themselves · watch the standings shift
        all season.
      </footer>
    </div>
  );
}
