"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Replaces Next's bare "Application error" when a page throws.
// retry() re-renders the failed page.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-5xl" aria-hidden>🔌</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">Something went wrong. Try again in a moment.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => retry()} className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04263a] hover:brightness-110">
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Back to the house
        </Link>
      </div>
    </main>
  );
}
