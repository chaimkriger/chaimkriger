"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

/** Modal built on the native <dialog>: focus trap, Escape and backdrop for free. */
export function Dialog({ open, onClose, title, children, footer, side = false, wide = false }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; side?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-black/45 backdrop:backdrop-blur-[2px]",
        side ? "fixed inset-y-0 left-auto right-0 h-dvh w-full sm:w-[30rem]" : "fixed inset-0 flex h-dvh w-full items-end justify-center sm:items-center",
      )}
    >
      <div
        className={cx(
          "flex flex-col bg-surface shadow-pop",
          side ? "h-full animate-left border-l border-line" : cx("max-h-[90dvh] w-full animate-up rounded-t-3xl border border-line sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-md"),
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink">
            <X size={18} />
          </button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </dialog>
  );
}
