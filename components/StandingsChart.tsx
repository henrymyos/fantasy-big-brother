"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WeeklyStandings } from "@/lib/scoring";

/**
 * Standings over time: one 2px line per team, cumulative points by week.
 * Rendered at measured pixel width (no viewBox scaling) so text stays
 * readable at every screen size. Hover/focus shows a crosshair snapped to
 * the nearest week with a readout of every team; the same numbers live in
 * the collapsible table below, so the tooltip never gates a value.
 */

const H = 280;
const PAD = { top: 16, bottom: 30, left: 44 };
const SURFACE = "var(--surface)";
const GRID = "var(--surface-2)";

function niceStep(range: number, targetTicks: number): number {
  const raw = Math.max(1, range / targetTicks);
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= raw) return m * pow;
  }
  return 10 * pow;
}

export function StandingsChart({ data }: { data: WeeklyStandings }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { weeks, series } = data;
  const W = Math.max(320, width);

  // Direct end-labels ride the line ends when there's room for them; the
  // legend + tooltip always carry every team regardless.
  const showEndLabels = series.length <= 4 && W >= 520;
  const longestName = Math.max(...series.map((s) => s.team.name.length), 4);
  const padRight = showEndLabels
    ? Math.min(130, 24 + longestName * 6.8)
    : 16;

  const geom = useMemo(() => {
    const lo = Math.min(0, ...series.map((s) => Math.min(...s.totals)));
    const hi = Math.max(10, ...series.map((s) => Math.max(...s.totals)));
    const step = niceStep(hi - lo, 4);
    const yMax = Math.ceil(hi / step) * step;
    const yMin = Math.floor(lo / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);

    const plotW = W - PAD.left - padRight;
    const plotH = H - PAD.top - PAD.bottom;
    const x = (week: number) =>
      PAD.left + (weeks.length < 2 ? 0 : (week / weeks[weeks.length - 1]) * plotW);
    const y = (v: number) =>
      PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
    return { x, y, ticks, yMin };
  }, [W, padRight, weeks, series]);

  const { x, y, ticks, yMin } = geom;
  const lastWeek = weeks[weeks.length - 1];

  // Keep every direct end-label at least 14px from the one above it; a label
  // that would collide is dropped (legend + tooltip still identify the line).
  const endLabels = useMemo(() => {
    if (!showEndLabels) return new Set<string>();
    const ends = series
      .map((s) => ({ id: s.team.id, y: y(s.totals[s.totals.length - 1]) }))
      .sort((a, b) => a.y - b.y);
    const kept = new Set<string>();
    let lastY = -Infinity;
    for (const e of ends) {
      if (e.y - lastY >= 14) {
        kept.add(e.id);
        lastY = e.y;
      }
    }
    return kept;
  }, [series, showEndLabels, y]);

  // Every Nth week tick so labels never crowd.
  const xTickEvery = Math.max(1, Math.ceil(weeks.length / Math.max(3, W / 90)));

  const weekFromClientX = (clientX: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || weeks.length < 2) return lastWeek;
    const px = clientX - rect.left - PAD.left;
    const frac = px / (W - PAD.left - padRight);
    return Math.round(Math.min(1, Math.max(0, frac)) * lastWeek);
  };

  const hover =
    hoverWeek === null
      ? null
      : {
          week: hoverWeek,
          x: x(hoverWeek),
          rows: series
            .map((s) => ({ team: s.team, total: s.totals[hoverWeek] }))
            .sort((a, b) => b.total - a.total),
        };
  const hoverFrac = hover ? hover.x / W : 0;

  return (
    <div>
      {/* Legend — the dependable identity channel for every series. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
        {series.map((s) => (
          <span key={s.team.id} className="inline-flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3.5 rounded-full"
              style={{ height: 3, background: s.team.color }}
            />
            <span className="text-[var(--muted)]">{s.team.name}</span>
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-lg"
        tabIndex={0}
        role="img"
        aria-label={`Cumulative points by week for ${series.length} teams. Use arrow keys to read values; the table below lists every value.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const cur = hoverWeek ?? lastWeek;
            const next = e.key === "ArrowLeft" ? cur - 1 : cur + 1;
            setHoverWeek(Math.min(lastWeek, Math.max(0, next)));
          } else if (e.key === "Escape") {
            setHoverWeek(null);
          }
        }}
        onBlur={() => setHoverWeek(null)}
      >
        {width > 0 && (
          <svg
            width={W}
            height={H}
            className="block"
            onPointerMove={(e) => setHoverWeek(weekFromClientX(e.clientX))}
            onPointerLeave={() => setHoverWeek(null)}
          >
            {/* gridlines + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - padRight}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 && yMin < 0 ? "var(--border)" : GRID}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(t) + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t.toLocaleString()}
                </text>
              </g>
            ))}

            {/* x ticks */}
            {weeks
              .filter((w) => w > 0 && w % xTickEvery === 0)
              .map((w) => (
                <text
                  key={w}
                  x={x(w)}
                  y={H - PAD.bottom + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--muted)"
                >
                  {`W${w}`}
                </text>
              ))}

            {/* crosshair */}
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

            {/* series lines */}
            {series.map((s) => (
              <polyline
                key={s.team.id}
                points={s.totals.map((v, i) => `${x(weeks[i])},${y(v)}`).join(" ")}
                fill="none"
                stroke={s.team.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* hover dots, end dots (surface ring keeps them legible) */}
            {series.map((s) => (
              <g key={s.team.id}>
                {hover && hover.week < lastWeek && (
                  <circle
                    cx={hover.x}
                    cy={y(s.totals[hover.week])}
                    r={4}
                    fill={s.team.color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={x(lastWeek)}
                  cy={y(s.totals[s.totals.length - 1])}
                  r={4}
                  fill={s.team.color}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
                {endLabels.has(s.team.id) && (
                  <text
                    x={x(lastWeek) + 10}
                    y={y(s.totals[s.totals.length - 1]) + 3.5}
                    fontSize={11}
                    fill="var(--foreground)"
                  >
                    {s.team.name}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}

        {/* tooltip — one readout, every series, values lead */}
        {hover && (
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
            <div className="text-[11px] text-[var(--muted)] mb-1">
              {hover.week === 0 ? "Start" : `Week ${hover.week}`}
            </div>
            {hover.rows.map((r) => (
              <div key={r.team.id} className="flex items-center gap-2 text-xs leading-5">
                <span
                  className="inline-block w-3 rounded-full shrink-0"
                  style={{ height: 3, background: r.team.color }}
                />
                <span className="font-semibold font-mono tabular-nums w-9 text-right">
                  {r.total}
                </span>
                <span className="text-[var(--muted)] truncate max-w-36">
                  {r.team.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* table view — the keyboard/screen-reader/no-hover twin of the chart */}
      <details className="mt-2">
        <summary className="text-xs text-[var(--muted)] cursor-pointer select-none hover:text-foreground">
          View data as table
        </summary>
        <div className="overflow-x-auto mt-2">
          <table className="text-xs w-full min-w-max">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="text-left font-medium pr-4 py-1">Week</th>
                {series.map((s) => (
                  <th key={s.team.id} className="text-right font-medium px-3 py-1">
                    {s.team.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums font-mono">
              {weeks
                .filter((w) => w > 0)
                .map((w) => (
                  <tr key={w} className="border-t border-[var(--border)]">
                    <td className="pr-4 py-1 font-sans text-[var(--muted)]">{w}</td>
                    {series.map((s) => (
                      <td key={s.team.id} className="text-right px-3 py-1">
                        {s.totals[w]}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
