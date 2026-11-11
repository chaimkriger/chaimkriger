"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          // On success the action redirects and never returns a result.
          const r = await loginAction({ email, password, next });
          if (r && !r.ok) setError(r.error ?? "Could not sign in.");
        });
      }}
    >
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input name="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
