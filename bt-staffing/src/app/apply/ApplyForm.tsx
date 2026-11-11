"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { submitApplyFormAction } from "@/app/actions";
import { DAYS, DAY_LABELS, LANGUAGES, PERIODS, PERIOD_LABELS, TRAVEL_OPTIONS } from "@/lib/constants";

const input = "field mt-1.5 !rounded-xl !py-3 !text-base";
const label = "block text-sm font-medium text-ink";
const DRAFT_KEY = "uc-apply-draft";

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-3 py-2.5 text-[0.95rem] font-medium transition active:scale-[0.98] ${active ? "border-ink bg-inverse text-inverse-ink" : "border-line-strong bg-surface text-ink"}`}
    >
      {children}
    </button>
  );
}

const STEPS = ["About you", "Experience", "Availability", "Start date"];

const empty = {
  firstName: "", lastName: "", mobile: "", email: "", addressOrZip: "",
  certification: "", maxTravelMinutes: 30, hasCar: null as boolean | null,
  languages: ["English"] as string[], earliestStart: "", website: "",
};

export function ApplyForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(empty);
  const [slots, setSlots] = useState<string[]>([]);

  // Keep a draft on the phone, so a dropped connection or a closed tab loses nothing.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.f) setF({ ...empty, ...d.f });
        if (Array.isArray(d?.slots)) setSlots(d.slots);
      }
    } catch {
      /* private mode: carry on without a draft */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, slots }));
    } catch {
      /* ignore */
    }
  }, [f, slots]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setError(null);
    setF((s) => ({ ...s, [k]: v }));
  };
  const toggleSlot = (k: string) => {
    setError(null);
    setSlots((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };
  const togglePeriod = (p: string) => {
    setError(null);
    const keys = DAYS.slice(0, 5).map((d) => `${d}_${p}`);
    setSlots((s) => (keys.every((k) => s.includes(k)) ? s.filter((x) => !keys.includes(x)) : [...new Set([...s, ...keys])]));
  };
  const toggleLang = (l: string) => set("languages", f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l]);

  /** What is wrong with the current step, or null. */
  const problem = (s: number): string | null => {
    if (s === 0) {
      if (!f.firstName.trim()) return "Please enter your first name";
      if (!f.lastName.trim()) return "Please enter your last name";
      if (f.mobile.replace(/\D/g, "").replace(/^1/, "").length !== 10) return "Please enter a valid 10-digit mobile number";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return "Please enter a valid email address";
      if (f.addressOrZip.trim().length < 5) return "Enter your home address or ZIP code";
    }
    if (s === 1) {
      if (!f.certification) return "Tell us if you are BT/RBT certified";
      if (f.hasCar === null) return "Tell us if you have a car";
      if (!f.languages.length) return "Choose at least one language";
    }
    if (s === 2 && !slots.length) return "Tap at least one time you can work";
    return null;
  };

  const next = () => {
    const p = problem(step);
    if (p) return setError(p);
    setError(null);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  const submit = () => {
    for (let s = 0; s < 3; s++) {
      const p = problem(s);
      if (p) {
        setStep(s);
        return setError(p);
      }
    }
    setError(null);
    start(async () => {
      const r = await submitApplyFormAction({ ...f, hasCar: f.hasCar, availability: slots });
      if (r.ok) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        router.push("/apply/thanks");
      } else setError(r.error ?? "Please check the form");
    });
  };

  const last = step === STEPS.length - 1;

  return (
    <form
      className="mt-6 flex flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (last) submit();
        else next();
      }}
    >
      <div aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-line-strong"}`} />
          ))}
        </div>
        <div className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-ink-3">Step {step + 1} of {STEPS.length}</div>
      </div>

      <div key={step} className="mt-2 flex-1 animate-up">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Thanks for applying!</h1>
              <p className="mt-1 text-[0.95rem] text-ink-2">Two minutes, four short steps. This helps us match you to a case near you.</p>
            </div>
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
              <span className="mt-1.5 block text-xs font-normal text-ink-3">Used only to find cases close to you.</span>
            </label>
            {/* Honeypot: hidden from people, tempting to bots. */}
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" name="website" value={f.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">A little about your experience</h1>
            <fieldset>
              <legend className={label}>Are you BT/RBT certified?</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[["CERTIFIED", "Yes"], ["NOT_CERTIFIED", "No"], ["IN_PROGRESS", "In progress"]].map(([v, l]) => (
                  <Choice key={v} active={f.certification === v} onClick={() => set("certification", v)}>{l}</Choice>
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">When can you work?</h1>
              <p className="mt-1 text-[0.95rem] text-ink-2">Tap every time that works. More times means more cases we can offer you.</p>
            </div>
            <fieldset>
              <legend className="sr-only">Weekly availability</legend>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                  <button key={p} type="button" onClick={() => togglePeriod(p)} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-2">
                    Weekday {PERIOD_LABELS[p].toLowerCase()}s
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[2.6rem_repeat(3,1fr)] items-center gap-1.5 text-center text-xs text-ink-3">
                <div />
                {PERIODS.map((p) => <div key={p} className="font-medium">{PERIOD_LABELS[p]}</div>)}
                {DAYS.map((d) => (
                  <div key={d} className="contents">
                    <div className="text-left text-sm font-medium text-ink">{DAY_LABELS[d]}</div>
                    {PERIODS.map((p) => {
                      const k = `${d}_${p}`;
                      const on = slots.includes(k);
                      return (
                        <button
                          key={k} type="button" aria-pressed={on} aria-label={`${DAY_LABELS[d]} ${PERIOD_LABELS[p]}`}
                          onClick={() => toggleSlot(k)}
                          className={`flex h-11 items-center justify-center rounded-xl border transition active:scale-95 ${on ? "border-ink bg-inverse text-inverse-ink" : "border-line-strong bg-surface text-transparent"}`}
                        >
                          <Check size={16} strokeWidth={3} />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">{slots.length ? `${slots.length} time${slots.length === 1 ? "" : "s"} selected` : "Nothing selected yet"}</p>
            </fieldset>
            <fieldset>
              <legend className={label}>How far will you travel to a case?</legend>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {TRAVEL_OPTIONS.map((m) => (
                  <Choice key={m} active={f.maxTravelMinutes === m} onClick={() => set("maxTravelMinutes", m)}>{m} min</Choice>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Last one: when can you start?</h1>
              <p className="mt-1 text-[0.95rem] text-ink-2">Leave it empty if you can start right away.</p>
            </div>
            <label className={label}>
              Earliest start date
              <input className={input} type="date" value={f.earliestStart} onChange={(e) => set("earliestStart", e.target.value)} />
            </label>
            <dl className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
              {[
                ["Name", `${f.firstName} ${f.lastName}`],
                ["Mobile", f.mobile],
                ["Email", f.email],
                ["Home", f.addressOrZip],
                ["Certified", f.certification === "CERTIFIED" ? "Yes" : f.certification === "IN_PROGRESS" ? "In progress" : "No"],
                ["Car", f.hasCar ? "Yes" : "No"],
                ["Languages", f.languages.join(", ")],
                ["Availability", `${slots.length} times a week, up to ${f.maxTravelMinutes} min away`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-ink-3">{k}</dt><dd className="min-w-0 truncate text-right text-ink">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-6 bg-canvas/95 px-5 pb-3 pt-3 backdrop-blur">
        {error && <p role="alert" className="mb-3 rounded-xl bg-notready-soft px-3.5 py-2.5 text-sm text-notready-ink">{error}</p>}
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => { setError(null); setStep((s) => s - 1); }} className="flex h-13 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-4 py-3.5 text-base font-medium text-ink">
              <ArrowLeft size={18} /> Back
            </button>
          )}
          <button disabled={pending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-inverse px-4 py-3.5 text-base font-semibold text-inverse-ink transition active:scale-[0.99] disabled:opacity-60">
            {pending ? <><Loader2 size={18} className="animate-spin" /> Sending</> : last ? "Submit" : <>Next <ArrowRight size={18} /></>}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-ink-3">Your details are used only by United Care ABA recruiting.</p>
      </div>
    </form>
  );
}
