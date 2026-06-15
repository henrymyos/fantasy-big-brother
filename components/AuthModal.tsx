"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Input } from "./ui";

export function AuthModal({
  onClose,
  reason,
}: {
  onClose: () => void;
  reason?: string;
}) {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const err =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setMessage(err);
    } else {
      onClose(); // signed in — auth listener takes over
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          {reason ??
            "Sign in to create or join a shared family league."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="w-full"
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {message && (
          <p className="text-sm text-amber-300 mt-3">{message}</p>
        )}

        <p className="text-sm text-[var(--muted)] mt-4 text-center">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMessage(null);
            }}
            className="text-accent hover:underline cursor-pointer"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
