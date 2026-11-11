import type { Metadata } from "next";
import Link from "next/link";
import { STAGE_LABELS } from "@/lib/constants";
import { dashboardData } from "@/lib/services/dashboard";
import { Card, CaseGlyph, CaseLink, PageHeader, Stat, WaitPill } from "@/components/ui";

export const metadata: Metadata = { title: "Insights" };

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

/** One-series horizontal bars: label, thin bar, value. */
function BarList({ rows, unit = "" }: { rows: { label: string; value: number; note?: string; href?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const inner = (
          <div className="group grid grid-cols-[9.5rem_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${r.value}${unit}${r.note ? ` (${r.note})` : ""}`}>
            <span className="truncate text-ink-2 group-hover:text-ink">{r.label}</span>
            <span className="h-2.5 rounded-r-full bg-sunken">
              {r.value > 0 && <span className="block h-2.5 rounded-r-full bg-s1 transition-[filter] group-hover:brightness-110" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />}
            </span>
            <span className="num w-20 text-right text-ink">
              {r.value}{unit}
              {r.note && <span className="ml-1.5 text-xs text-ink-3">{r.note}</span>}
            </span>
          </div>
        );
        return <li key={r.label}>{r.href ? <Link href={r.href}>{inner}</Link> : inner}</li>;
      })}
    </ul>
  );
}

/** One-series columns with the value on top of each column. */
function Columns({ rows, height = 150, unit = "" }: { rows: { label: string; value: number; note?: string }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex items-end gap-3" style={{ height: height + 44 }} role="img" aria-label={rows.map((r) => `${r.label}: ${r.value}${unit}`).join(", ")}>
      {rows.map((r) => (
        <div key={r.label} className="group flex flex-1 flex-col items-center justify-end gap-1.5" title={`${r.label}: ${r.value}${unit}${r.note ? ` (${r.note})` : ""}`}>
          <span className="num text-sm font-medium text-ink">{r.value}{unit}</span>
          <span className="w-full max-w-14 rounded-t-[4px] bg-s1 transition-[filter] group-hover:brightness-110" style={{ height: Math.max(2, (r.value / max) * height) }} />
          <span className="whitespace-nowrap text-xs text-ink-3">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Single line with a labelled point per month. */
function LineChart({ points, unit }: { points: { label: string; value: number | null; note?: string }[]; unit: string }) {
  const W = 560, H = 190, padX = 34, padTop = 30, padBottom = 30;
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const max = Math.max(1, ...values) * 1.15;
  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const path = points.map((p, i) => (p.value == null ? null : `${x(i)},${y(p.value)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={points.map((p) => `${p.label}: ${p.value ?? "no data"}${p.value != null ? unit : ""}`).join(", ")}>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={padX - 10} x2={W - padX + 10} y1={padTop + t * (H - padTop - padBottom)} y2={padTop + t * (H - padTop - padBottom)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <polyline points={path} fill="none" stroke="var(--s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.label}>
          {p.value != null && (
            <>
              <circle cx={x(i)} cy={y(p.value)} r="5" fill="var(--s1)" stroke="var(--surface)" strokeWidth="2">
                <title>{`${p.label}: ${p.value}${unit}${p.note ? ` (${p.note})` : ""}`}</title>
              </circle>
              <text x={x(i)} y={y(p.value) - 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{p.value}{unit}</text>
            </>
          )}
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--ink-3)">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default async function DashboardPage() {
  const d = await dashboardData();
  const longest = d.openCases.slice(0, 6);
  const pipelineTotal = Math.max(1, d.stages.reduce((s, x) => s + x.count, 0));
  const monthTotals = d.months.map((m, i) => ({ label: monthLabel(m), value: d.recruiterRows.reduce((s, r) => s + r.counts[i], 0) }));
  const maxCell = Math.max(1, ...d.recruiterRows.flatMap((r) => r.counts));
  return (
    <>
      <PageHeader title="Insights" subtitle="How many cases are waiting, how fast people move from applied to placed, and who is placing." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Cases waiting" tone="case" value={d.openCases.length} note="Needs staffing or restaffing" href="/queues/open-cases" />
        <Stat label="Average wait" value={<>{d.avgWait}<span className="text-lg text-ink-3"> days</span></>} note={`Longest: ${d.maxWait} days`} href="/queues/open-cases" />
        <Stat label="Ready to place" tone="ready" value={d.readyApplicants} note="New hires with nothing missing" href="/queues/place" />
        <Stat label="Placements this month" tone="staff" value={d.placementsThisMonth} note="Primary placements" />
        <Stat label="Applied to placed" value={d.medianAll == null ? "-" : <>{d.medianAll}<span className="text-lg text-ink-3"> days</span></>} note={`Median, last 6 months (${d.placedCount} people)`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cases waiting, by days waiting" hint="How long open cases have been without a BT">
          <Columns rows={d.buckets.map((b) => ({ label: b.label, value: b.count }))} />
          <h3 className="mb-1 mt-6 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Longest waiting</h3>
          <ul className="divide-y divide-line text-sm">
            {longest.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2.5"><CaseGlyph status={c.status} size={24} /><CaseLink id={c.id} code={c.code} /> <span className="text-xs text-ink-3">{c.city}, {c.state}</span></span>
                <WaitPill days={d.waits[i]} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Applicants by stage" hint="People who have been placed move to Staff and are not counted here">
          <BarList rows={d.stages.map((s) => ({
            label: s.stage === "APPLIED" ? "Form not completed" : STAGE_LABELS[s.stage],
            value: s.count,
            note: `${Math.round((s.count / pipelineTotal) * 100)}%`,
            href: `/applicants?stage=${s.stage}`,
          }))} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Placements per recruiter per month" hint="Primary placements, by the recruiter who made them">
          <Columns height={110} rows={monthTotals} />
          <div className="scroll-thin mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                  <th className="py-1.5 pr-3 font-medium">Recruiter</th>
                  {d.months.map((m) => <th key={m} className="px-1 py-1.5 text-center font-medium">{monthLabel(m)}</th>)}
                  <th className="py-1.5 pl-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.recruiterRows.map((r) => (
                  <tr key={r.name} className="border-t border-line">
                    <td className="whitespace-nowrap py-1.5 pr-3 font-medium text-ink">{r.name}</td>
                    {r.counts.map((n, i) => (
                      <td key={i} className="px-1 py-1.5 text-center">
                        <span
                          className="num inline-flex h-7 w-9 items-center justify-center rounded-md text-[0.8rem]"
                          title={`${r.name}, ${monthLabel(d.months[i])}: ${n}`}
                          style={{ background: n ? `color-mix(in srgb, var(--s1) ${Math.round(12 + (n / maxCell) * 38)}%, transparent)` : "transparent", color: n ? "var(--ink)" : "var(--ink-3)" }}
                        >
                          {n}
                        </span>
                      </td>
                    ))}
                    <td className="num py-1.5 pl-3 text-right font-semibold text-ink">{r.total}</td>
                  </tr>
                ))}
                {d.recruiterRows.length === 0 && <tr><td colSpan={d.months.length + 2} className="py-4 text-center text-ink-3">No placements yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Time from applied to placed" hint="Median days, by the month the person was placed">
          <LineChart unit="d" points={d.timeByMonth.map((t) => ({ label: monthLabel(t.month), value: t.median, note: `${t.count} placed` }))} />
          <p className="mt-2 text-xs text-ink-3">
            {d.timeByMonth.map((t) => `${monthLabel(t.month)}: ${t.count} placed`).join(" · ")}
          </p>
        </Card>
      </div>
    </>
  );
}
