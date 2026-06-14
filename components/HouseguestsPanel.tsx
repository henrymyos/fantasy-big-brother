"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SAMPLE_NAMES } from "@/lib/defaults";
import { computeHouseguestScores } from "@/lib/scoring";
import type { HouseguestStatus } from "@/lib/types";
import {
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
  const draftedIds = new Set(state.picks.map((p) => p.houseguestId));

  const submit = () => {
    const names = bulk.split(/[\n,]/);
    addHouseguests(names);
    setBulk("");
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
      <Card>
        <SectionTitle
          title="Add houseguests"
          subtitle="Paste the cast — one name per line or comma-separated."
        />
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={"Alex\nBrianna\nCarlos"}
          rows={8}
          className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-accent placeholder:text-[var(--muted)] resize-y"
        />
        <div className="flex gap-2 mt-3">
          <Button variant="primary" onClick={submit} disabled={!bulk.trim()}>
            Add to cast
          </Button>
          <Button
            variant="ghost"
            onClick={() => setBulk(SAMPLE_NAMES.join("\n"))}
          >
            Use sample cast
          </Button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          {state.houseguests.length} houseguests ·{" "}
          {state.houseguests.filter((h) => h.status === "active").length} still
          in the house
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="The cast"
          subtitle="Set who's been evicted as the season plays out."
        />
        {state.houseguests.length === 0 ? (
          <EmptyState>No houseguests yet. Add the cast to get started.</EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {scores.map(({ houseguest: hg, points }) => (
              <li
                key={hg.id}
                className="flex items-center gap-3 py-2.5 flex-wrap"
              >
                <div
                  className={`size-9 shrink-0 rounded-full grid place-items-center font-semibold text-sm ${
                    hg.status === "active"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-slate-600/30 text-slate-300"
                  }`}
                >
                  {hg.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={hg.name}
                    onChange={(e) =>
                      updateHouseguest(hg.id, { name: e.target.value })
                    }
                    className="bg-transparent font-medium outline-none focus:underline w-full"
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={hg.status} />
                    {hg.exitWeek ? (
                      <span className="text-xs text-[var(--muted)]">
                        Week {hg.exitWeek}
                      </span>
                    ) : null}
                    {draftedIds.has(hg.id) && (
                      <span className="text-xs text-[var(--muted)]">
                        · drafted
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right mr-1">
                  <Points value={points} />
                  <div className="text-[10px] text-[var(--muted)]">pts</div>
                </div>
                <Select
                  value={hg.status}
                  onChange={(e) =>
                    setHouseguestStatus(
                      hg.id,
                      e.target.value as HouseguestStatus,
                    )
                  }
                  className="w-auto"
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
