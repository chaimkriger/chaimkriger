"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { onToast, type ToastMessage } from "./toast";

export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setItems((xs) => [...xs.slice(-3), t]);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === "error" ? 7000 : 3800);
      }),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1200] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-md animate-up items-start gap-2.5 rounded-xl bg-inverse px-4 py-3 text-sm text-inverse-ink shadow-pop"
        >
          {t.kind === "success" ? <CheckCircle2 size={18} className="mt-px shrink-0 text-ready" /> : t.kind === "error" ? <XCircle size={18} className="mt-px shrink-0 text-notready" /> : <Info size={18} className="mt-px shrink-0" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
