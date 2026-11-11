"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNoteAction, setAgeGroupsAction, setChecklistAction } from "@/app/actions";

export function ChecklistToggle({ personId, itemKey, label, group, done, disabled }: { personId: string; itemKey: string; label: string; group: string; done: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={done}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.checked;
          setError(null);
          start(async () => {
            const r = await setChecklistAction(personId, itemKey, next);
            if (!r.ok) setError(r.error ?? "Could not save");
            router.refresh();
          });
        }}
      />
      <span className={done ? "text-slate-500 line-through" : "text-slate-900"}>{label}</span>
      <span className="text-xs text-slate-400">{group}</span>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
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
                await setAgeGroupsAction(personId, on ? value.filter((v) => v !== o.value) : [...value, o.value]);
                router.refresh();
              })
            }
            className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset disabled:opacity-60 ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300"}`}
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
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await addNoteAction(personId, body);
          if (r.ok) setBody("");
          else setError(r.error ?? "Could not save");
          router.refresh();
        });
      }}
      className="flex gap-2"
    >
      <input aria-label="New note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      <button disabled={pending} className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-60">Add</button>
      {error && <span role="alert" className="self-center text-xs text-red-700">{error}</span>}
    </form>
  );
}
