"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitApplyFormAction } from "@/app/actions";
import { DAYS, DAY_LABELS, LANGUAGES, PERIODS, PERIOD_LABELS, TRAVEL_OPTIONS } from "@/lib/constants";

const input = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base";
const label = "block text-sm font-medium text-slate-800";

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-800"}`}
    >
      {children}
    </button>
  );
}

export function ApplyForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    firstName: "", lastName: "", mobile: "", email: "", addressOrZip: "",
    certification: "", maxTravelMinutes: 30, hasCar: null as boolean | null,
    languages: ["English"] as string[], earliestStart: "", website: "",
  });
  const [slots, setSlots] = useState<string[]>([]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleSlot = (k: string) => setSlots((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const togglePeriod = (p: string) => {
    const keys = DAYS.slice(0, 5).map((d) => `${d}_${p}`);
    setSlots((s) => (keys.every((k) => s.includes(k)) ? s.filter((x) => !keys.includes(x)) : [...new Set([...s, ...keys])]));
  };
  const toggleLang = (l: string) =>
    set("languages", f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.certification) return setError("Tell us if you are BT/RBT certified");
    if (f.hasCar === null) return setError("Tell us if you have a car");
    start(async () => {
      const r = await submitApplyFormAction({ ...f, hasCar: f.hasCar, availability: slots });
      if (r.ok) router.push("/apply/thanks");
      else setError(r.error ?? "Please check the form");
    });
  }

  return (
    <form onSubmit={submit} onChangeCapture={() => setError(null)} onClickCapture={() => setError(null)} className="mt-5 space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          First name
          <input className={input} autoComplete="given-name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </label>
        <label className={label}>
          Last name
          <input className={input} autoComplete="family-name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </label>
      </div>
      <label className={label}>
        Mobile number
        <input className={input} type="tel" inputMode="tel" autoComplete="tel" placeholder="(718) 555-0100" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} />
      </label>
      <label className={label}>
        Email
        <input className={input} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
      </label>
      <label className={label}>
        Home address or ZIP code
        <input className={input} autoComplete="street-address" placeholder="Street, city, state ZIP, or just ZIP" value={f.addressOrZip} onChange={(e) => set("addressOrZip", e.target.value)} />
      </label>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} />

      <fieldset>
        <legend className={label}>Are you BT/RBT certified?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[["CERTIFIED", "Yes"], ["NOT_CERTIFIED", "No"], ["IN_PROGRESS", "In progress"]].map(([v, l]) => (
            <Choice key={v} active={f.certification === v} onClick={() => set("certification", v)}>{l}</Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>When can you work? Tap all that apply.</legend>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => togglePeriod(p)} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
              Weekday {PERIOD_LABELS[p].toLowerCase()}s
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 text-center text-xs text-slate-600">
          <div />
          {PERIODS.map((p) => <div key={p} className="font-medium">{PERIOD_LABELS[p]}</div>)}
          {DAYS.map((d) => (
            <div key={d} className="contents">
              <div className="pr-1 text-left text-sm font-medium text-slate-800">{DAY_LABELS[d]}</div>
              {PERIODS.map((p) => {
                const k = `${d}_${p}`;
                const on = slots.includes(k);
                return (
                  <button
                    key={k} type="button" aria-pressed={on} aria-label={`${DAY_LABELS[d]} ${PERIOD_LABELS[p]}`}
                    onClick={() => toggleSlot(k)}
                    className={`h-10 rounded-lg border text-sm ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-transparent"}`}
                  >
                    ✓
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>How far will you travel to a case?</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {TRAVEL_OPTIONS.map((m) => (
            <Choice key={m} active={f.maxTravelMinutes === m} onClick={() => set("maxTravelMinutes", m)}>{m} min</Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Do you have a car?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Choice active={f.hasCar === true} onClick={() => set("hasCar", true)}>Yes</Choice>
          <Choice active={f.hasCar === false} onClick={() => set("hasCar", false)}>No</Choice>
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Languages you speak</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Choice key={l} active={f.languages.includes(l)} onClick={() => toggleLang(l)}>{l}</Choice>
          ))}
        </div>
      </fieldset>

      <label className={label}>
        Earliest start date
        <input className={input} type="date" value={f.earliestStart} onChange={(e) => set("earliestStart", e.target.value)} />
      </label>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60">
        {pending ? "Sending..." : "Submit"}
      </button>
      <p className="pb-6 text-center text-xs text-slate-500">Your details are used only by United Care ABA recruiting.</p>
    </form>
  );
}
