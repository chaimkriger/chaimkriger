"use client";

import { buttonClass } from "@/components/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">This screen hit a problem</h1>
      <p className="mt-2 text-sm text-ink-2">Nothing was changed. Try again; if it keeps happening, tell your admin what you were doing.</p>
      <button onClick={reset} className={buttonClass("primary", "md", "mt-5")}>Try again</button>
    </div>
  );
}
