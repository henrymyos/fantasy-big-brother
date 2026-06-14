"use client";

import { useState } from "react";
import { useStore, type SyncStatus } from "@/lib/store";
import { Button } from "./ui";

const STATUS_DOT: Record<SyncStatus, { color: string; label: string }> = {
  local: { color: "#8c98bd", label: "On this device only" },
  connecting: { color: "#eab308", label: "Connecting…" },
  online: { color: "#22c55e", label: "Live — shared with your league" },
  saving: { color: "#38bdf8", label: "Saving…" },
  error: { color: "#ef4444", label: "Sync error" },
};

export function ShareControls() {
  const {
    supabaseEnabled,
    leagueId,
    syncStatus,
    createSharedLeague,
    joinLeague,
    leaveSharedLeague,
  } = useStore();
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabaseEnabled) return null;

  const dot = STATUS_DOT[syncStatus];

  const create = async () => {
    setBusy(true);
    setError(null);
    await createSharedLeague();
    setBusy(false);
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    const ok = await joinLeague(joinInput);
    setBusy(false);
    if (ok) {
      setJoining(false);
      setJoinInput("");
    } else {
      setError("Couldn't find that league. Check the link or code.");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"
        title={dot.label}
      >
        <span
          className="size-2 rounded-full"
          style={{ background: dot.color }}
        />
        {leagueId ? "Shared" : "Local"}
      </span>

      {leagueId ? (
        <>
          <Button variant="primary" size="sm" onClick={copyLink}>
            {copied ? "Copied!" : "Copy invite link"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Stop syncing on this device? Your league stays online for everyone else."))
                leaveSharedLeague();
            }}
          >
            Leave
          </Button>
        </>
      ) : joining ? (
        <div className="flex items-center gap-1.5">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="Paste invite link or code"
            className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-2.5 py-1.5 text-xs outline-none focus:border-accent w-48"
            onKeyDown={(e) => e.key === "Enter" && join()}
            autoFocus
          />
          <Button variant="primary" size="sm" onClick={join} disabled={busy || !joinInput.trim()}>
            Join
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setJoining(false)}>
            ✕
          </Button>
        </div>
      ) : (
        <>
          <Button variant="primary" size="sm" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Share with family"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setJoining(true)}>
            Join
          </Button>
        </>
      )}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
