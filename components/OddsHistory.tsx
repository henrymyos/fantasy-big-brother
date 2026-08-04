"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { oddsFor } from "@/lib/odds";
import { displayName } from "@/lib/wiki";
import { Avatar, Card, SectionTitle } from "./ui";

/**
 * Kalshi win odds over the season: one snapshot per reveal, each priced as
 * its episode aired, so the chart is the market's story as the family saw
 * it. Avatar chips toggle whose lines show; the top few by current odds
 * start selected.
 */

const H = 240;
const PAD = { top: 14, bottom: 26, left: 36, right: 16 };

/** Distinct line colors, assigned by current-odds rank. */
const PALETTE = [
  "#38bdf8",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
  "#a3e635",
  "#e879f9",
  "#4ade80",
  "#facc15",
  "#818cf8",
  "#fda4af",
  "#2dd4bf",
  "#c084fc",
  "#94a3b8",
];

export function OddsHistory() {
  const { state } = useStore();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const history = useMemo(
    () =>
      [...(state.oddsHistory ?? [])].sort((a, b) => a.gateKey - b.gateKey),
    [state.oddsHistory],
  );

  // One series per houseguest with any market data, ranked by latest odds.
  const series = useMemo(() => {
    if (history.length < 2) return [];
    const latest = history[history.length - 1];
    return state.houseguests
      .map((hg) => ({
        hg,
        values: history.map((s) => oddsFor(s.list, hg.name)),
        now: oddsFor(latest.list, hg.name),
      }))
      .filter((s) => s.values.some((v) => v !== null))
      .sort((a, b) => (b.now ?? -1) - (a.now ?? -1))
      .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
  }, [history, state.houseguests]);

  if (history.length < 2 || series.length === 0) return null;

  const shown = selected ?? new Set(series.slice(0, 5).map((s) => s.hg.id));
  const active = series.filter((s) => shown.has(s.hg.id));

  const W = Math.max(320, width);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = history.length;
  const yMaxRaw = Math.max(10, ...active.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const yMax = Math.ceil(yMaxRaw / 10) * 10;
  const x = (i: number) => PAD.left + (n < 2 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString([], { month: "numeric", day: "numeric" });
  const xTickEvery = Math.max(1, Math.ceil(n / Math.max(3, W / 80)));

  const idxFromClientX = (clientX: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return n - 1;
    const frac = (clientX - rect.left - PAD.left) / plotW;
    return Math.round(Math.min(1, Math.max(0, frac)) * (n - 1));
  };

  let hover: {
    idx: number;
    x: number;
    rows: { s: (typeof active)[number]; v: number }[];
  } | null = null;
  if (hoverIdx !== null) {
    const idx = hoverIdx;
    hover = {
      idx,
      x: x(idx),
      rows: active
        .map((s) => ({ s, v: s.values[idx] }))
        .filter((r): r is { s: (typeof active)[number]; v: number } => r.v !== null)
        .sort((a, b) => b.v - a.v),
    };
  }
  const hoverFrac = hover ? hover.x / W : 0;

  const toggle = (hgId: string) => {
    const next = new Set(shown);
    if (next.has(hgId)) next.delete(hgId);
    else next.add(hgId);
    setSelected(next);
  };

  return (
    <Card>
      <SectionTitle
        title="Odds over time"
        subtitle="Kalshi's winner market at each reveal, priced as that episode aired — tap faces to add or hide lines."
      />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {series.map((s) => {
          const on = shown.has(s.hg.id);
          return (
            <button
              key={s.hg.id}
              type="button"
              onClick={() => toggle(s.hg.id)}
              aria-pressed={on}
              title={`${displayName(s.hg.name)} — now ${s.now ?? 0}%`}
              className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs font-medium border transition cursor-pointer ${
                on
                  ? "bg-[var(--surface-2)]"
                  : "border-transparent opacity-45 hover:opacity-100"
              }`}
              style={on ? { borderColor: s.color } : undefined}
            >
              <Avatar
                name={s.hg.name}
                src={s.hg.photoUrl}
                active={s.hg.status !== "evicted"}
                size={20}
              />
              <span className={s.hg.status === "evicted" ? "line-through" : ""}>
                {displayName(s.hg.name)}
              </span>
              <span className="font-mono tabular-nums text-[var(--muted)]">
                {s.now ?? 0}%
              </span>
            </button>
          );
        })}
      </div>

      <div ref={wrapRef} className="relative">
        {width > 0 && (
          <svg
            width={W}
            height={H}
            className="block"
            onPointerMove={(e) => setHoverIdx(idxFromClientX(e.clientX))}
            onPointerLeave={() => setHoverIdx(null)}
          >
            {[0, yMax / 2, yMax].map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--surface-2)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(t) + 3.5}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t}%
                </text>
              </g>
            ))}

            {history
              .map((s, i) => ({ s, i }))
              .filter(({ i }) => i % xTickEvery === 0 || i === n - 1)
              .map(({ s, i }) => (
                <text
                  key={s.gateKey}
                  x={x(i)}
                  y={H - PAD.bottom + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--muted)"
                  suppressHydrationWarning
                >
                  {fmtDate(s.takenAt)}
                </text>
              ))}

            {hover && (
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--border)"
                strokeWidth={1}
              />
            )}

            {active.map((s) => {
              const pts = s.values
                .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
                .filter((p): p is string => p !== null)
                .join(" ");
              let lastIdx = 0;
              s.values.forEach((v, i) => {
                if (v !== null) lastIdx = i;
              });
              const lastV = s.values[lastIdx];
              return (
                <g key={s.hg.id}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {lastV !== null && (
                    <circle
                      cx={x(lastIdx)}
                      cy={y(lastV)}
                      r={3.5}
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  )}
                  {hover && s.values[hover.idx] !== null && (
                    <circle
                      cx={hover.x}
                      cy={y(s.values[hover.idx]!)}
                      r={3.5}
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {hover && hover.rows.length > 0 && (
          <div
            className="absolute top-1 z-10 pointer-events-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/95 backdrop-blur px-3 py-2 shadow-lg"
            style={{
              left: `${hoverFrac * 100}%`,
              transform:
                hoverFrac > 0.72
                  ? "translateX(calc(-100% - 10px))"
                  : "translateX(10px)",
            }}
          >
            <div
              className="text-[11px] text-[var(--muted)] mb-1"
              suppressHydrationWarning
            >
              As of {fmtDate(history[hover.idx].takenAt)}
            </div>
            {hover.rows.map(({ s, v }) => (
              <div
                key={s.hg.id}
                className="flex items-center gap-2 text-xs leading-5"
              >
                <span
                  className="inline-block w-3 rounded-full shrink-0"
                  style={{ height: 3, background: s.color }}
                />
                <span className="font-semibold font-mono tabular-nums w-8 text-right">
                  {v}%
                </span>
                <span className="text-[var(--muted)] truncate max-w-32">
                  {displayName(s.hg.name)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
