"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { computeHouseguestScores, houseguestStatLine } from "@/lib/scoring";
import type { HouseguestStatus } from "@/lib/types";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Points,
  SectionTitle,
  Select,
  StatusBadge,
} from "./ui";

const STATUS_OPTIONS: { value: HouseguestStatus; label: string }[] = [
  { value: "active", label: "In the house" },
  { value: "evicted", label: "Evicted" },
  { value: "jury", label: "Jury" },
  { value: "runnerup", label: "Runner-up" },
  { value: "winner", label: "Winner" },
];

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
      {children}
    </span>
  );
}

export function HouseguestsPanel() {
  const {
    state,
    addHouseguests,
    removeHouseguest,
    setHouseguestStatus,
    updateHouseguest,
  } = useStore();
  const [bulk, setBulk] = useState("");

  const scores = computeHouseguestScores(state);
  const teamByHg = new Map(
    state.picks.map((p) => [
      p.houseguestId,
      state.teams.find((t) => t.id === p.teamId),
    ]),
  );

  const submit = () => {
    const names = bulk.split(/[\n,]/);
    addHouseguests(names);
    setBulk("");
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
      <Card>
        <SectionTitle
          title="The house"
          subtitle="The cast, photos, evictions and comp wins all sync themselves from Wikipedia."
        />
        <p className="text-sm text-[var(--muted)]">
          {state.houseguests.length} houseguests ·{" "}
          {state.houseguests.filter((h) => h.status === "active").length} still
          in the house
        </p>
        <details className="mt-4">
          <summary className="text-xs text-[var(--muted)] cursor-pointer select-none hover:text-foreground">
            Add someone manually
          </summary>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"One name per line"}
            rows={4}
            className="w-full mt-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-accent placeholder:text-[var(--muted)] resize-y"
          />
          <Button
            variant="primary"
            className="mt-2"
            onClick={submit}
            disabled={!bulk.trim()}
          >
            Add to cast
          </Button>
        </details>
      </Card>

      <Card>
        <SectionTitle
          title="The cast"
          subtitle="Set who's been evicted as the season plays out."
        />
        {state.houseguests.length === 0 ? (
          <EmptyState>No houseguests yet. Add the cast to get started.</EmptyState>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {scores.map(({ houseguest: hg, points }) => {
              const stats = houseguestStatLine(hg.id, state);
              const team = teamByHg.get(hg.id);
              const out = hg.status === "evicted";
              return (
                <li
                  key={hg.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 flex flex-col gap-2.5"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={hg.name}
                      src={hg.photoUrl}
                      active={!out}
                      size={52}
                    />
                    <div className="min-w-0 flex-1">
                      <input
                        value={hg.name}
                        onChange={(e) =>
                          updateHouseguest(hg.id, { name: e.target.value })
                        }
                        className={`bg-transparent font-medium outline-none focus:underline w-full ${
                          out ? "text-[var(--muted)]" : ""
                        }`}
                      />
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={hg.status} />
                        {hg.exitWeek ? (
                          <span className="text-xs text-[var(--muted)]">
                            Week {hg.exitWeek}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Points value={points} />
                      <div className="text-[10px] text-[var(--muted)]">pts</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {stats.hohWins > 0 && (
                      <StatChip>👑 {stats.hohWins}× HOH</StatChip>
                    )}
                    {stats.vetoWins > 0 && (
                      <StatChip>🛡️ {stats.vetoWins}× Veto</StatChip>
                    )}
                    {stats.otherCompWins > 0 && (
                      <StatChip>
                        🎯 {stats.otherCompWins}{" "}
                        {stats.otherCompWins === 1 ? "comp" : "comps"}
                      </StatChip>
                    )}
                    {stats.eventCount === 0 && (
                      <span className="text-[11px] text-[var(--muted)]">
                        No scoring events yet
                      </span>
                    )}
                    {team && (
                      <StatChip>
                        <span
                          className="size-2 rounded-full inline-block"
                          style={{ background: team.color }}
                        />
                        {team.name}
                      </StatChip>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Select
                      value={hg.status}
                      onChange={(e) =>
                        setHouseguestStatus(
                          hg.id,
                          e.target.value as HouseguestStatus,
                        )
                      }
                      className="flex-1"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeHouseguest(hg.id)}
                      aria-label={`Remove ${hg.name}`}
                    >
                      ✕
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
