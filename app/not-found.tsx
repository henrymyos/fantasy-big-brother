import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-5xl" aria-hidden>🏈</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That link doesn&apos;t lead anywhere in the house.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04263a] hover:brightness-110">
          Back to the house
        </Link>
        <Link href="/awards" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Awards
        </Link>
      </div>
    </main>
  );
}
