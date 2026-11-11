"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { Dialog } from "./Dialog";
import { toast } from "./toast";
import { BUTTON, buttonClass } from "./button";

export interface ConfirmSpec {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

/**
 * Button that runs a server action, shows a toast with the outcome and
 * refreshes the page. With `confirm`, it asks first in a proper dialog.
 */
export function ActionButton({
  action, children, variant = "secondary", confirm, size = "sm", disabled, title, className, onDone,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: keyof typeof BUTTON.variant;
  confirm?: ConfirmSpec;
  size?: keyof typeof BUTTON.size;
  disabled?: boolean;
  title?: string;
  className?: string;
  onDone?: (r: ActionResult) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  const run = () => {
    setAsking(false);
    start(async () => {
      const r = await action();
      // A redirecting action resolves to undefined.
      if (r) {
        if (r.ok) {
          if (r.message) toast("success", r.message);
        } else {
          toast("error", r.error ?? "Something went wrong.");
        }
        onDone?.(r);
      }
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        title={title}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm) setAsking(true);
          else run();
        }}
        className={buttonClass(variant, size, className)}
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {children}
      </button>
      {confirm && (
        <Dialog
          open={asking}
          onClose={() => setAsking(false)}
          title={confirm.title}
          footer={
            <>
              <button type="button" className={buttonClass("secondary", "md")} onClick={() => setAsking(false)}>Cancel</button>
              <button type="button" className={buttonClass(confirm.danger ? "danger" : "primary", "md")} onClick={run} data-confirm>
                {confirm.confirmLabel}
              </button>
            </>
          }
        >
          <div className="text-sm leading-relaxed text-ink-2">{confirm.body}</div>
        </Dialog>
      )}
    </>
  );
}
