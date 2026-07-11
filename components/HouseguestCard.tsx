"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Avatar, Points, StatusBadge } from "./ui";

/** Tap-a-houseguest popup: photo, status, and their scoring history. */
export function HouseguestCard({
  houseguestId,
  onClose,
}: {
  houseguestId: string;
  onClose: () => void;
}) {
  const { state } = useStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hg = state.houseguests.find((h) => h.id === houseguestId);
  if (!hg) return null;

  const rules = new Map(state.rules.map((r) => [r.id, r]));
  const pick = state.picks.find((p) => p.houseguestId === hg.id);
  const team = pick
    ? state.teams.find((t) => t.id === pick.teamId)
    : undefined;

  const history = state.events
    .filter((e) => e.houseguestId === hg.id)
    .map((e) => ({ event: e, rule: rules.get(e.ruleId) }))
    .filter((x) => x.rule)
    .sort(
      (a, b) =>
        a.event.week - b.event.week ||
        Math.abs(b.rule!.points) - Math.abs(a.rule!.points),
    );
  const total = history.reduce((sum, x) => sum + x.rule!.points, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${hg.name} details`}
    >
      <div
        className="card w-full max-w-sm max-h-[85dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-5 pb-4">
          <Avatar
            name={hg.name}
            src={hg.photoUrl}
            active={hg.status !== "evicted"}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-lg leading-tight">{hg.name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={hg.status} />
              {hg.exitWeek ? (
                <span className="text-xs text-[var(--muted)]">
                  Week {hg.exitWeek}
                </span>
              ) : null}
            </div>
            {team && (
              <p className="text-xs text-[var(--muted)] mt-1.5 flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full inline-block"
                  style={{ background: team.color }}
                />
                Drafted by {team.name} · pick {pick!.overall}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 size-7 rounded-lg grid place-items-center text-[var(--muted)] hover:text-foreground hover:bg-[var(--surface-2)] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono">{total}</span>
          <span className="text-xs text-[var(--muted)]">
            points · {history.length} scoring events
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-3">
              No scoring events yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {history.map(({ event, rule }) => (
                <li
                  key={event.id}
                  className="flex items-center gap-3 py-1.5 text-sm"
                >
                  <span className="text-[var(--muted)] text-xs font-mono w-9 shrink-0">
                    Wk {event.week}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{rule!.label}</span>
                  <Points value={rule!.points} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
