"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions";

export function LoginForm({ next, demo }: { next: string; demo: { label: string; email: string; password: string }[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: string, p: string) => {
    setError(null);
    start(async () => {
      // On success the action redirects and never returns a result.
      const r = await loginAction({ email: e, password: p, next });
      if (r && !r.ok) setError(r.error ?? "Could not sign in.");
    });
  };
  return (
    <>
      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(email, password);
        }}
      >
        <label className="block text-sm font-medium text-ink">
          Email
          <input name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1.5 !py-2.5" />
        </label>
        <label className="block text-sm font-medium text-ink">
          Password
          <input name="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1.5 !py-2.5" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-notready-soft px-3 py-2 text-sm text-notready-ink">{error}</p>}
        <button disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-inverse text-sm font-medium text-inverse-ink transition hover:opacity-90 disabled:opacity-60">
          {pending && <Loader2 size={16} className="animate-spin" />}
          {pending ? "Signing in" : "Sign in"}
        </button>
      </form>
      {demo.length > 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong p-4">
          <div className="text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Demo accounts</div>
          <p className="mt-1 text-xs text-ink-3">Fake data only. One click signs you in as that role.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {demo.map((d) => (
              <button
                key={d.email}
                type="button"
                disabled={pending}
                data-demo={d.label}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  submit(d.email, d.password);
                }}
                className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-ink disabled:opacity-50"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
