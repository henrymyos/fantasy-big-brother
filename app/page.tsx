"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";
import { StandingsPanel } from "@/components/StandingsPanel";
import { HouseguestsPanel } from "@/components/HouseguestsPanel";
import { DraftPanel } from "@/components/DraftPanel";
import { ScoringPanel } from "@/components/ScoringPanel";
import { SyncPanel } from "@/components/SyncPanel";
import type { LeagueState } from "@/lib/types";

type TabId = "standings" | "houseguests" | "draft" | "scoring" | "sync";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "standings", label: "Standings", icon: "🏆" },
  { id: "houseguests", label: "Houseguests", icon: "🏠" },
  { id: "draft", label: "Draft", icon: "📋" },
  { id: "scoring", label: "Scoring", icon: "⭐" },
  { id: "sync", label: "Auto-sync", icon: "🔄" },
];

export default function Home() {
  const { state, loaded, setSeasonName, replaceState, resetAll } = useStore();
  const [tab, setTab] = useState<TabId>("standings");
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.seasonName.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as LeagueState;
        replaceState(parsed);
        alert("League imported successfully.");
      } catch {
        alert("That file could not be read as a league export.");
      }
    };
    reader.readAsText(file);
  };

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
            <p className="text-xs text-[var(--muted)]">
              Fantasy Big Brother · saved in this browser
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={exportData}>
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Import
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Reset the entire league? This clears teams, cast, draft and scores.",
                  )
                )
                  resetAll();
              }}
            >
              Reset
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importData(f);
                e.target.value = "";
              }}
            />
          </div>
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
            {tab === "houseguests" && <HouseguestsPanel />}
            {tab === "draft" && <DraftPanel />}
            {tab === "scoring" && <ScoringPanel />}
            {tab === "sync" && <SyncPanel />}
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        Draft houseguests · log weekly events · watch the standings shift all
        season.
      </footer>
    </div>
  );
}
