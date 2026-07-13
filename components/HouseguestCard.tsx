"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { oddsFor } from "@/lib/odds";
import { scoutFor, SCOUTING_TOTAL } from "@/lib/scouting";
import { Avatar, Points, StatusBadge } from "./ui";

/** Fandom thumbnails end in /scale-to-width-down/320 — drop it for full res. */
function fullSizePhoto(url: string): string {
  return url.replace(/\/scale-to-width-down\/\d+/, "");
}

/** Tap-a-houseguest popup: photo, status, and their scoring history. */
export function HouseguestCard({
  houseguestId,
  onClose,
}: {
  houseguestId: string;
  onClose: () => void;
}) {
  const { state } = useStore();
  const [photoOpen, setPhotoOpen] = useState(false);
  const odds = state.odds?.list ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape peels one layer at a time: lightbox first, then the card.
      setPhotoOpen((open) => {
        if (!open) onClose();
        return false;
      });
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

  const scout = scoutFor(hg.name);
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
          {hg.photoUrl ? (
            <button
              onClick={() => setPhotoOpen(true)}
              className="shrink-0 cursor-zoom-in rounded-full hover:ring-2 hover:ring-accent/60 transition"
              title={`Enlarge ${hg.name}'s photo`}
              aria-label={`Enlarge ${hg.name}'s photo`}
            >
              <Avatar
                name={hg.name}
                src={hg.photoUrl}
                active={hg.status !== "evicted"}
                size={72}
              />
            </button>
          ) : (
            <Avatar
              name={hg.name}
              src={hg.photoUrl}
              active={hg.status !== "evicted"}
              size={72}
            />
          )}
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
          {odds !== null && oddsFor(odds, hg.name) !== null && (
            <span className="ml-auto text-xs text-[var(--muted)]">
              📈 <span className="font-semibold text-foreground">
                {oddsFor(odds, hg.name)}%
              </span>{" "}
              to win (Kalshi)
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {scout && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3.5 mb-3">
              <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">
                Scouting report ·{" "}
                <span className="text-accent">
                  projected #{scout.rank} of {SCOUTING_TOTAL}
                </span>
              </p>
              <p className="text-sm mt-1.5 leading-snug">{scout.blurb}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wide mb-1">
                    Strengths
                  </p>
                  <ul className="space-y-0.5">
                    {scout.strengths.map((s) => (
                      <li key={s} className="text-xs leading-snug flex gap-1.5">
                        <span className="text-emerald-300 shrink-0">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-red-300 uppercase tracking-wide mb-1">
                    Weaknesses
                  </p>
                  <ul className="space-y-0.5">
                    {scout.weaknesses.map((w) => (
                      <li key={w} className="text-xs leading-snug flex gap-1.5">
                        <span className="text-red-300 shrink-0">−</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
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

      {/* Photo lightbox — sits above the card; click or Escape closes it. */}
      {photoOpen && hg.photoUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm grid place-items-center p-4 cursor-zoom-out"
          onClick={(e) => {
            e.stopPropagation();
            setPhotoOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${hg.name} photo`}
        >
          <figure className="text-center">
            {/* Remote fandom image; the static export has no optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullSizePhoto(hg.photoUrl)}
              alt={hg.name}
              referrerPolicy="no-referrer"
              className={`max-h-[80dvh] max-w-full rounded-2xl object-contain shadow-2xl ${
                hg.status === "evicted" ? "grayscale" : ""
              }`}
            />
            <figcaption className="mt-3 text-sm font-semibold text-white">
              {hg.name}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
