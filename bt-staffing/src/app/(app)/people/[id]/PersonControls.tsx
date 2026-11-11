"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { addNoteAction, setAgeGroupsAction, setChecklistAction } from "@/app/actions";
import { toast } from "@/components/toast";
import { cx } from "@/components/ui";

export function ChecklistToggle({ personId, itemKey, label, done, disabled }: { personId: string; itemKey: string; label: string; done: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Tick immediately, then confirm with the server.
  const [checked, setChecked] = useState(done);
  useEffect(() => setChecked(done), [done]);
  return (
    <label className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition", disabled ? "" : "cursor-pointer hover:bg-sunken")}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          start(async () => {
            const r = await setChecklistAction(personId, itemKey, next);
            if (!r.ok) {
              toast("error", r.error ?? "Could not save");
              setChecked(!next);
            }
            router.refresh();
          });
        }}
      />
      <span className={cx("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2", checked ? "border-ready bg-ready text-white" : "border-line-strong bg-surface text-transparent")}>
        <Check size={12} strokeWidth={3.5} />
      </span>
      <span className={checked ? "text-ink-3 line-through decoration-line-strong" : "text-ink"}>{label}</span>
    </label>
  );
}

export function AgeGroupEditor({ personId, value, options, disabled }: { personId: string; value: string[]; options: { value: string; label: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled || pending}
            onClick={() =>
              start(async () => {
                const r = await setAgeGroupsAction(personId, on ? value.filter((v) => v !== o.value) : [...value, o.value]);
                if (!r.ok) toast("error", r.error ?? "Could not save");
                router.refresh();
              })
            }
            className={cx("rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-60", on ? "border-ink bg-inverse text-inverse-ink" : "border-line-strong bg-surface text-ink-2 hover:text-ink")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NoteForm({ personId }: { personId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNoteAction(personId, body);
          if (r.ok) setBody("");
          else toast("error", r.error ?? "Could not save");
          router.refresh();
        });
      }}
      className="flex gap-2"
    >
      <input aria-label="New note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note" className="field min-w-0 flex-1" />
      <button disabled={pending || !body.trim()} className="h-[2.35rem] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-medium hover:bg-raised disabled:opacity-50">Add</button>
    </form>
  );
}
