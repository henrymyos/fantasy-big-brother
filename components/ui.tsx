"use client";

import { useState } from "react";
import { CATEGORY_META } from "@/lib/defaults";
import type { HouseguestStatus } from "@/lib/types";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md";
};

export function Button({
  variant = "subtle",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const sizes = {
    sm: "text-xs px-2.5 py-1.5",
    md: "text-sm px-3.5 py-2",
  };
  const variants = {
    primary:
      "bg-accent text-[#04263a] hover:brightness-110 font-semibold shadow-sm",
    ghost:
      "bg-transparent text-foreground hover:bg-[var(--surface-2)] border border-[var(--border)]",
    subtle: "bg-[var(--surface-2)] text-foreground hover:brightness-125",
    danger: "bg-transparent text-red-300 hover:bg-red-500/15 border border-red-500/30",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-accent placeholder:text-[var(--muted)] ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-accent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

const STATUS_META: Record<
  HouseguestStatus,
  { label: string; cls: string }
> = {
  active: { label: "In the house", cls: "bg-emerald-500/15 text-emerald-300" },
  jury: { label: "Jury", cls: "bg-amber-500/15 text-amber-300" },
  evicted: { label: "Evicted", cls: "bg-slate-500/20 text-slate-300" },
  runnerup: { label: "Runner-up", cls: "bg-sky-500/15 text-sky-300" },
  winner: { label: "Winner 👑", cls: "bg-yellow-400/20 text-yellow-200" },
};

export function StatusBadge({ status }: { status: HouseguestStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? { label: category, color: "#888" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${meta.color}22`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

/** Cast photo with an initial-letter fallback (also used while loading). */
export function Avatar({
  name,
  src,
  active = true,
  size = 36,
  className = "",
}: {
  name: string;
  src?: string | null;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      // Remote fandom thumbnails; the static export has no image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover object-top bg-[var(--surface-2)] ${
          active ? "" : "grayscale opacity-70"
        } ${className}`}
        style={style}
      />
    );
  }
  return (
    <div
      className={`shrink-0 rounded-full grid place-items-center font-semibold ${
        active
          ? "bg-emerald-500/20 text-emerald-200"
          : "bg-slate-600/30 text-slate-300"
      } ${className}`}
      style={{ ...style, fontSize: Math.max(11, size * 0.4) }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

export function Points({ value }: { value: number }) {
  const sign = value > 0 ? "+" : "";
  const color =
    value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-[var(--muted)]";
  return (
    <span className={`font-mono font-semibold tabular-nums ${color}`}>
      {sign}
      {value}
    </span>
  );
}

export function EmptyState({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="text-center text-sm text-[var(--muted)] py-10 border border-dashed border-[var(--border)] rounded-xl">
      {children}
    </div>
  );
}
