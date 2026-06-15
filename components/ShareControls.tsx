"use client";

import { useState } from "react";
import { useStore, type SyncStatus } from "@/lib/store";
import { Button } from "./ui";
import { AuthModal } from "./AuthModal";

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
    authReady,
    user,
    signOut,
    leagueId,
    isOwner,
    members,
    syncStatus,
    createSharedLeague,
    joinLeague,
    leaveSharedLeague,
    deleteLeague,
    removeMember,
  } = useStore();

  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  if (!supabaseEnabled || !authReady) return null;

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
      setError("Couldn't open that league. Check the link or code.");
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

  // ── Signed out ────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: STATUS_DOT.local.color }}
          />
          On this device only
        </span>
        <Button variant="primary" size="sm" onClick={() => setAuthOpen(true)}>
          Sign in to share
        </Button>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2 flex-wrap relative">
      <span
        className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--muted)]"
        title={dot.label}
      >
        <span className="size-2 rounded-full" style={{ background: dot.color }} />
        {leagueId ? "Shared live" : "Local"}
      </span>

      {leagueId ? (
        <>
          <Button variant="primary" size="sm" onClick={copyLink}>
            {copied ? "Copied!" : "Copy invite link"}
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembers((v) => !v)}
            >
              Members ({members.length}) ▾
            </Button>
            {showMembers && (
              <div className="absolute right-0 mt-1 w-64 card p-2 z-30 text-sm">
                <p className="text-xs text-[var(--muted)] px-2 pb-1">
                  Anyone with the invite link can join.
                </p>
                <ul className="max-h-56 overflow-auto">
                  {members.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface-2)]"
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {m.email || "member"}
                        {m.user_id === user.id && (
                          <span className="text-[var(--muted)]"> (you)</span>
                        )}
                      </span>
                      {m.role === "owner" ? (
                        <span className="text-[10px] text-yellow-200">
                          owner
                        </span>
                      ) : isOwner ? (
                        <button
                          onClick={() => removeMember(m.user_id)}
                          className="text-[11px] text-red-300 hover:underline cursor-pointer"
                        >
                          remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isOwner ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Delete this league for everyone? This permanently removes it.",
                  )
                )
                  deleteLeague();
              }}
            >
              Delete league
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Leave this league?")) leaveSharedLeague();
              }}
            >
              Leave
            </Button>
          )}
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
          <Button
            variant="primary"
            size="sm"
            onClick={join}
            disabled={busy || !joinInput.trim()}
          >
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

      {/* account menu */}
      <div className="relative">
        <button
          onClick={() => setShowAccount((v) => !v)}
          className="text-xs text-[var(--muted)] hover:text-foreground cursor-pointer px-1.5"
          title={user.email}
        >
          {user.email.split("@")[0]} ▾
        </button>
        {showAccount && (
          <div className="absolute right-0 mt-1 w-48 card p-1.5 z-30 text-sm">
            <div className="px-2 py-1 text-xs text-[var(--muted)] truncate">
              {user.email}
            </div>
            <button
              onClick={async () => {
                setShowAccount(false);
                await signOut();
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-2)] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
