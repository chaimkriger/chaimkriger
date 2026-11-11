import Link from "next/link";
import { CASE_STATUS_LABELS, DAYS, DAY_LABELS, PERIODS, PERIOD_LABELS, STAGE_HELP, STAGE_LABELS, type StageKey } from "@/lib/constants";
import { matchLabel } from "@/lib/matching";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, eyebrow, children }: { title: React.ReactNode; subtitle?: React.ReactNode; eyebrow?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-ink-3">{eyebrow}</div>}
        <h1 className="text-[1.7rem] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[0.93rem] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, hint, children, className = "", actions, flush = false }: { title?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode; flush?: boolean }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <div>
            <h2 className="text-[0.93rem] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-ink-2">{icon}</div>}
      <div className="text-sm font-semibold text-ink">{title}</div>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-2">{children}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status language: one set of colours and glyphs used on badges, avatars and map pins.
// ---------------------------------------------------------------------------

export type Tone = "ready" | "notready" | "staff" | "case" | "restaff" | "neutral";

const TONE_SOFT: Record<Tone, string> = {
  ready: "bg-ready-soft text-ready-ink",
  notready: "bg-notready-soft text-notready-ink",
  staff: "bg-staff-soft text-staff-ink",
  case: "bg-case-soft text-case-ink",
  restaff: "bg-restaff-soft text-restaff-ink",
  neutral: "bg-sunken text-ink-2",
};
const TONE_DOT: Record<Tone, string> = {
  ready: "bg-ready", notready: "bg-notready", staff: "bg-staff", case: "bg-case", restaff: "bg-restaff", neutral: "bg-ink-3",
};

export function Badge({ tone = "neutral", children, title, dot = false, className = "" }: { tone?: Tone; children: React.ReactNode; title?: string; dot?: boolean; className?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-medium leading-5", TONE_SOFT[tone], className)}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />}
      {children}
    </span>
  );
}

export function personTone(kind: string, ready: boolean): Tone {
  return kind === "STAFF" ? "staff" : ready ? "ready" : "notready";
}

export function ReadyBadge({ ready }: { ready: boolean }) {
  return ready ? <Badge tone="ready">✓ Ready</Badge> : <Badge tone="notready">! Not ready</Badge>;
}

export function KindBadge({ kind }: { kind: string }) {
  return kind === "STAFF" ? <Badge tone="staff">Current staff</Badge> : <Badge>New hire</Badge>;
}

export function StageBadge({ stage }: { stage: string }) {
  const help = STAGE_HELP[stage as StageKey];
  if (stage === "APPLIED") return <Badge tone="case" title={help}>Form not completed</Badge>;
  return <Badge title={help} tone={stage === "PLACED" ? "staff" : stage === "READY_TO_PLACE" ? "ready" : "neutral"}>{STAGE_LABELS[stage as StageKey] ?? stage}</Badge>;
}

export function caseTone(status: string): Tone {
  return status === "NEEDS_STAFFING" ? "case" : status === "RESTAFFING" ? "restaff" : status === "STAFFED" ? "ready" : "neutral";
}

export function CaseStatusBadge({ status }: { status: string }) {
  return <Badge tone={caseTone(status)} dot>{CASE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function CertBadge({ certification, kind }: { certification: string; kind?: string }) {
  if (certification === "CERTIFIED") return <Badge className="ring-1 ring-inset ring-line-strong !bg-surface !text-ink">RBT</Badge>;
  const base = kind === "STAFF" ? "BT" : "Not certified";
  return <Badge>{certification === "IN_PROGRESS" ? `${base} · RBT in progress` : base}</Badge>;
}

/** Initials in a circle; the ring carries the person's status colour. */
export function Avatar({ name, tone = "neutral", size = 36 }: { name: string; tone?: Tone; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const ring: Record<Tone, string> = {
    ready: "ring-ready", notready: "ring-notready", staff: "ring-staff", case: "ring-case", restaff: "ring-restaff", neutral: "ring-line-strong",
  };
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-semibold text-ink-2 ring-2 ring-offset-2 ring-offset-surface", ring[tone])}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

/** Diamond marker for cases, matching the map pin. */
export function CaseGlyph({ status, size = 30 }: { status: string; size?: number }) {
  const restaffing = status === "RESTAFFING";
  const closed = status === "STAFFED" || status === "DISCHARGED";
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span
        className={cx("flex items-center justify-center rounded-[5px] text-[0.62rem] font-bold", closed ? "bg-sunken text-ink-3" : restaffing ? "bg-restaff text-white" : "bg-case text-[#17171b]")}
        style={{ width: size * 0.72, height: size * 0.72, transform: "rotate(45deg)" }}
      >
        <span style={{ transform: "rotate(-45deg)" }}>{restaffing ? "R" : "C"}</span>
      </span>
    </span>
  );
}

export function MissingList({ missing, max = 4 }: { missing: string[]; max?: number }) {
  if (!missing.length) return <span className="text-sm text-ink-3">Nothing missing</span>;
  const shown = missing.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((m) => (
        <span key={m} className="rounded-md bg-notready-soft px-1.5 py-0.5 text-xs text-notready-ink">{m}</span>
      ))}
      {missing.length > shown.length && (
        <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs text-ink-2" title={missing.slice(max).join(", ")}>+{missing.length - shown.length} more</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week grid
// ---------------------------------------------------------------------------

/**
 * Read-only week grid. `slots` are filled; `highlight` are drawn strongest
 * (e.g. hours that overlap a case); `muted` are hatched (booked / not covered).
 */
export function SlotGrid({ slots, highlight, muted, compact = false }: { slots: string[]; highlight?: string[]; muted?: string[]; compact?: boolean }) {
  const cell = compact ? "h-2.5 w-3.5 rounded-[3px]" : "h-7 w-full min-w-8 rounded-md";
  return (
    <table className={cx("border-separate text-[0.65rem] text-ink-3", compact ? "border-spacing-[2px]" : "w-full border-spacing-1")}>
      <thead>
        <tr>
          <th />
          {DAYS.map((d) => (
            <th key={d} className="font-medium">{compact ? DAY_LABELS[d][0] : DAY_LABELS[d]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PERIODS.map((p) => (
          <tr key={p}>
            <th className="pr-1 text-right font-medium">{compact ? PERIOD_LABELS[p].slice(0, 3) : PERIOD_LABELS[p]}</th>
            {DAYS.map((d) => {
              const key = `${d}_${p}`;
              const on = slots.includes(key);
              const hi = highlight?.includes(key);
              const mu = muted?.includes(key);
              return (
                <td key={key} title={`${DAY_LABELS[d]} ${PERIOD_LABELS[p].toLowerCase()}${hi ? ": covered" : on ? ": open" : mu ? ": not covered" : ""}`}>
                  <div
                    className={cx(cell, hi ? "bg-ready" : on ? "bg-ink" : mu ? "bg-line-strong" : "bg-sunken")}
                    style={mu && !hi && !on ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, var(--surface) 3px 5px)" } : undefined}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Score visuals
// ---------------------------------------------------------------------------

/** Circular progress, e.g. match score or pipeline completion. */
export function Ring({ value, max = 100, size = 44, stroke = 4, label, tone = "ink" }: { value: number; max?: number; size?: number; stroke?: number; label?: React.ReactNode; tone?: "ink" | "ready" | "notready" | "staff" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const color = { ink: "var(--ink)", ready: "var(--ready)", notready: "var(--notready)", staff: "var(--staff)" }[tone];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="num absolute text-ink" style={{ fontSize: size * 0.32, fontWeight: 650, letterSpacing: "-0.02em" }}>{label ?? Math.round(value)}</span>
    </span>
  );
}

/** Three-part match score: drive (40) + hours (40) + requirements (20). */
export function ScoreBar({ drive, availability, requirements, showLegend = false }: { drive: number; availability: number; requirements: number; showLegend?: boolean }) {
  const parts = [
    { key: "Drive", value: drive, max: 40, color: "var(--s1)" },
    { key: "Hours", value: availability, max: 40, color: "var(--s2)" },
    { key: "Fit", value: requirements, max: 20, color: "var(--s3)" },
  ];
  return (
    <div>
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-sunken" role="img" aria-label={parts.map((p) => `${p.key} ${p.value} of ${p.max}`).join(", ")}>
        {parts.map((p) => (
          <div key={p.key} title={`${p.key}: ${p.value} of ${p.max}`} style={{ width: `${p.value}%`, background: p.color }} className="h-full first:rounded-l-full" />
        ))}
      </div>
      {showLegend && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.7rem] text-ink-2">
          {parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.key} <span className="num text-ink">{p.value}</span>/{p.max}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      <span className="font-medium text-ink">The score (out of 100) adds up:</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-s1" />how close they live</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-s2" />how many of the hours they can cover</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-s3" />how well they fit the requirements</span>
    </div>
  );
}

/** The score as a word, so nobody has to interpret a number. */
export function MatchWord({ total, className = "" }: { total: number; className?: string }) {
  return <span className={cx("font-semibold text-ink", className)}>{matchLabel(total)}</span>;
}

/** "7 steps left" with a bar that fills as steps are done. */
export function StepsProgress({ done, total, tone = "notready" }: { done: number; total: number; tone?: "ready" | "notready" }) {
  const left = Math.max(0, total - done);
  return (
    <div className="w-full min-w-28" title={`${done} of ${total} steps done`}>
      <div className="text-sm font-semibold text-ink">
        {left === 0 ? "All steps done" : <><span className="num">{left}</span> {left === 1 ? "step" : "steps"} left</>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className={cx("h-full rounded-full", tone === "ready" ? "bg-ready" : "bg-notready")} style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="mt-1 text-[0.7rem] text-ink-3"><span className="num">{done}</span> of <span className="num">{total}</span> done</div>
    </div>
  );
}

export function fmtMiles(miles: number): string {
  return miles < 0.1 ? "Under 0.1 mi" : `${miles.toFixed(1)} mi`;
}

// ---------------------------------------------------------------------------
// Tables, links, filters
// ---------------------------------------------------------------------------

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-3">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:hover]:bg-raised [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-ink-3">Nothing here.</p>}
    </div>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={cx("px-4 py-2.5 align-middle", className)}>{children}</td>;
}

export function PersonLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/people/${id}`} className="font-medium text-ink decoration-line-strong underline-offset-4 hover:underline">{name}</Link>;
}

export function CaseLink({ id, code }: { id: string; code: string }) {
  return <Link href={`/cases/${id}`} className="num font-medium text-ink decoration-line-strong underline-offset-4 hover:underline">{code}</Link>;
}

/** Segmented control driven by a query parameter. */
export function FilterTabs({ base, param, value, options, extra = {} }: { base: string; param: string; value: string; options: { value: string; label: string; count?: number }[]; extra?: Record<string, string | undefined> }) {
  return (
    <div className="scroll-thin inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-sunken p-1">
      {options.map((o) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
        if (o.value) qs.set(param, o.value);
        const href = qs.toString() ? `${base}?${qs}` : base;
        const active = value === o.value;
        return (
          <Link key={o.value} href={href} scroll={false} aria-current={active ? "true" : undefined} className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-[0.82rem] font-medium transition", active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>
            {o.label}
            {o.count != null && <span className={cx("num ml-1.5 text-xs", active ? "text-ink-2" : "text-ink-3")}>{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, note, href, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string; tone?: Tone }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-line-strong">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {tone && <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />}
        {label}
      </div>
      <div className="num mt-1 text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-ink">{value}</div>
      {note && <div className="mt-1.5 text-xs text-ink-3">{note}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function daysSince(d: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400_000));
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtShort(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Days-waiting pill that heats up as the wait grows. */
export function WaitPill({ days }: { days: number }) {
  const tone: Tone = days > 30 ? "notready" : days > 14 ? "case" : "neutral";
  return <Badge tone={tone} title="How long this case has been waiting for a BT">Waiting <span className="num">{days}</span> {days === 1 ? "day" : "days"}</Badge>;
}
