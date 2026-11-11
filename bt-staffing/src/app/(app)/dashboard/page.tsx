import Link from "next/link";
import { STAGE_LABELS } from "@/lib/constants";
import { dashboardData } from "@/lib/services/dashboard";
import { Card, CaseLink, CaseStatusBadge, PageHeader } from "@/components/ui";

function Tile({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

/** One-series horizontal bars: label, thin bar, value. */
function Bars({ rows, unit = "" }: { rows: { label: string; value: number | null; note?: string; href?: string }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9.5rem_1fr_5.5rem] items-center gap-2 text-sm" title={`${r.label}: ${r.value ?? "no data"}${r.value != null ? unit : ""}${r.note ? ` (${r.note})` : ""}`}>
          <div className="truncate text-slate-700">{r.href ? <Link href={r.href} className="hover:underline">{r.label}</Link> : r.label}</div>
          <div className="h-3 rounded-r bg-slate-50">
            {r.value != null && r.value > 0 && <div className="h-3 rounded-r bg-brand-500" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }} />}
          </div>
          <div className="whitespace-nowrap text-right tabular-nums text-slate-900">
            {r.value == null ? <span className="text-slate-400">-</span> : `${r.value}${unit}`}
            {r.note && <span className="ml-1 text-xs text-slate-500">{r.note}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function DashboardPage() {
  const d = await dashboardData();
  const longest = [...d.openCases].slice(0, 8);
  return (
    <>
      <PageHeader title="Dashboard" subtitle="How many cases are waiting, how fast people move from applied to placed, and who is placing." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Cases waiting" value={d.openCases.length} note="Needs staffing or restaffing" href="/queues/open-cases" />
        <Tile label="Average wait" value={`${d.avgWait}d`} note={`Longest: ${d.maxWait} days`} href="/queues/open-cases" />
        <Tile label="Ready to place" value={d.readyApplicants} note="New hires with nothing missing" href="/queues/place" />
        <Tile label="Placements this month" value={d.placementsThisMonth} note="Primary placements" />
        <Tile label="Applied to placed" value={d.medianAll == null ? "-" : `${d.medianAll}d`} note={`Median, last 6 months (${d.placedCount} people)`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Cases waiting, by days waiting">
          <Bars rows={d.buckets.map((b) => ({ label: b.label, value: b.count }))} />
          <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Longest waiting</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {longest.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                <span><CaseLink id={c.id} code={c.code} /> <span className="text-xs text-slate-500">{c.city}, {c.state}</span></span>
                <span className="flex items-center gap-2"><CaseStatusBadge status={c.status} /><span className="w-16 text-right tabular-nums">{d.waits[i]} days</span></span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Applicants by stage">
          <Bars rows={d.stages.map((s) => ({
            label: s.stage === "APPLIED" ? "Form not completed" : STAGE_LABELS[s.stage],
            value: s.count,
            href: `/applicants?stage=${s.stage}`,
          }))} />
          <p className="mt-3 text-xs text-slate-500">People who have been placed move to Staff and are not counted here.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Placements per recruiter per month">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Recruiter</th>
                  {d.months.map((m) => <th key={m} className="px-2 py-1.5 text-right">{monthLabel(m)}</th>)}
                  <th className="py-1.5 pl-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.recruiterRows.map((r) => (
                  <tr key={r.name}>
                    <td className="whitespace-nowrap py-1.5 pr-3 font-medium">{r.name}</td>
                    {r.counts.map((n, i) => <td key={i} className={`px-2 py-1.5 text-right tabular-nums ${n === 0 ? "text-slate-300" : ""}`}>{n}</td>)}
                    <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{r.total}</td>
                  </tr>
                ))}
                {d.recruiterRows.length === 0 && <tr><td colSpan={d.months.length + 2} className="py-4 text-center text-slate-500">No placements yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Counts primary placements by the recruiter who made them.</p>
        </Card>
        <Card title="Time from applied to placed (median days, by month placed)">
          <Bars unit="d" rows={d.timeByMonth.map((t) => ({ label: monthLabel(t.month), value: t.median, note: t.count ? `n=${t.count}` : undefined }))} />
        </Card>
      </div>
    </>
  );
}
