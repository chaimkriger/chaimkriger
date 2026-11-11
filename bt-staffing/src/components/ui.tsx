import Link from "next/link";
import { CASE_STATUS_LABELS, DAYS, DAY_LABELS, PERIODS, PERIOD_LABELS, STAGE_LABELS, type StageKey } from "@/lib/constants";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  green: "bg-green-50 text-green-800 ring-green-600/20",
  red: "bg-red-50 text-red-800 ring-red-600/20",
  blue: "bg-blue-50 text-blue-800 ring-blue-600/20",
  amber: "bg-amber-50 text-amber-900 ring-amber-600/30",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function Badge({ tone = "slate", children, title }: { tone?: keyof typeof TONES | string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone] ?? TONES.slate}`}>
      {children}
    </span>
  );
}

export function ReadyBadge({ ready }: { ready: boolean }) {
  return ready ? <Badge tone="green">✓ Ready</Badge> : <Badge tone="red">! Not ready</Badge>;
}

export function KindBadge({ kind }: { kind: string }) {
  return kind === "STAFF" ? <Badge tone="blue">Current staff</Badge> : <Badge tone="slate">New hire</Badge>;
}

export function StageBadge({ stage }: { stage: string }) {
  if (stage === "APPLIED") return <Badge tone="amber">Form not completed</Badge>;
  return <Badge tone={stage === "PLACED" ? "blue" : stage === "READY_TO_PLACE" ? "green" : "slate"}>{STAGE_LABELS[stage as StageKey] ?? stage}</Badge>;
}

export function CaseStatusBadge({ status }: { status: string }) {
  const tone = status === "NEEDS_STAFFING" ? "amber" : status === "RESTAFFING" ? "violet" : status === "STAFFED" ? "green" : "slate";
  return <Badge tone={tone}>{CASE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function CertBadge({ certification, kind }: { certification: string; kind?: string }) {
  if (certification === "CERTIFIED") return <Badge tone="blue">RBT</Badge>;
  if (certification === "IN_PROGRESS") return <Badge tone="slate">{kind === "STAFF" ? "BT" : "Not certified"} · RBT in progress</Badge>;
  return <Badge tone="slate">{kind === "STAFF" ? "BT" : "Not certified"}</Badge>;
}

export function MissingList({ missing, max = 4 }: { missing: string[]; max?: number }) {
  if (!missing.length) return <span className="text-sm text-slate-500">Nothing missing</span>;
  const shown = missing.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((m) => (
        <span key={m} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800">{m}</span>
      ))}
      {missing.length > shown.length && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" title={missing.slice(max).join(", ")}>
          +{missing.length - shown.length} more
        </span>
      )}
    </div>
  );
}

/**
 * Read-only week grid. `slots` are filled; `highlight` (optional) are drawn
 * stronger, e.g. the hours that overlap a case; `muted` are booked hours.
 */
export function SlotGrid({ slots, highlight, muted, compact = false }: { slots: string[]; highlight?: string[]; muted?: string[]; compact?: boolean }) {
  const cell = compact ? "h-3 w-4" : "h-6 w-9";
  return (
    <table className="border-separate border-spacing-0.5 text-[10px] text-slate-500">
      <thead>
        <tr>
          <th />
          {DAYS.map((d) => (
            <th key={d} className="px-0.5 font-medium">{compact ? DAY_LABELS[d][0] : DAY_LABELS[d]}</th>
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
              const cls = hi ? "bg-green-600" : on ? "bg-brand-500" : mu ? "bg-slate-400" : "bg-slate-100";
              return (
                <td key={key} title={`${DAY_LABELS[d]} ${PERIOD_LABELS[p].toLowerCase()}${hi ? " (overlap)" : on ? "" : mu ? " (booked)" : " (not available)"}`}>
                  <div className={`${cell} rounded-sm ${cls}`} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-slate-500">Nothing here.</p>}
    </div>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function PersonLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/people/${id}`} className="font-medium text-brand-700 hover:underline">{name}</Link>;
}

export function CaseLink({ id, code }: { id: string; code: string }) {
  return <Link href={`/cases/${id}`} className="font-medium text-brand-700 hover:underline">{code}</Link>;
}

/** Link-styled filter tabs driven by a query parameter. */
export function FilterTabs({ base, param, value, options, extra = {} }: { base: string; param: string; value: string; options: { value: string; label: string; count?: number }[]; extra?: Record<string, string | undefined> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
        if (o.value) qs.set(param, o.value);
        const href = qs.toString() ? `${base}?${qs}` : base;
        const active = value === o.value;
        return (
          <Link key={o.value} href={href} className={`rounded-md px-2.5 py-1 text-sm ${active ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}>
            {o.label}
            {o.count != null && <span className={`ml-1.5 text-xs ${active ? "text-brand-100" : "text-slate-500"}`}>{o.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function daysSince(d: Date | string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400_000));
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
