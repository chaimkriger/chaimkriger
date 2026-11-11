import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="num text-6xl font-semibold tracking-[-0.04em] text-ink">404</div>
      <h1 className="mt-3 text-lg font-semibold text-ink">We could not find that page</h1>
      <p className="mt-1 text-sm text-ink-2">The person or case may have been removed, or the link is wrong.</p>
      <Link href="/today" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-inverse px-4 text-sm font-medium text-inverse-ink">Back to Today</Link>
    </main>
  );
}
