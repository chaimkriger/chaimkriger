"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions";

const VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50",
  ghost: "text-brand-700 hover:bg-brand-50",
};

/**
 * Button that runs a server action, then refreshes the page. Shows the
 * action's error (or success message) right under the button.
 */
export function ActionButton({
  action, children, variant = "secondary", confirm, size = "sm", disabled, title,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  confirm?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        disabled={pending || disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setResult(null);
          start(async () => {
            const r = await action();
            // A redirecting action resolves to undefined.
            if (r) setResult(r);
            router.refresh();
          });
        }}
        className={`whitespace-nowrap rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50 ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"} ${VARIANTS[variant]}`}
      >
        {pending ? "Working..." : children}
      </button>
      {result?.error && <span role="alert" className="max-w-xs text-xs text-red-700">{result.error}</span>}
      {result?.ok && result.message && <span role="status" className="max-w-xs text-xs text-green-700">{result.message}</span>}
    </span>
  );
}
