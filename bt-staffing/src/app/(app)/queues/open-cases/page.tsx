import type { Metadata } from "next";
import Link from "next/link";
import { openCasesQueue } from "@/lib/services/queues";
import { describeSlots } from "@/lib/availability";
import { AGE_GROUP_LABELS } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buttonClass } from "@/components/button";
import { QueueTabs } from "@/components/QueueTabs";
import { Avatar, Badge, CaseGlyph, CaseLink, daysSince, EmptyState, FilterTabs, PageHeader, personTone, WaitPill } from "@/components/ui";

export const metadata: Metadata = { title: "Open cases" };

export default async function OpenCasesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state = "" } = await searchParams;
  const user = await requireUser();
  const canPlace = can(user.role, "placement.make");
  const all = await openCasesQueue();
  const rows = (state ? all.filter((r) => r.case.state === state) : all).sort(
    (a, b) => a.case.waitingSince.getTime() - b.case.waitingSince.getTime(),
  );
  const maxDays = Math.max(1, ...rows.map((r) => daysSince(r.case.waitingSince)));
  return (
    <>
      <PageHeader title="Open cases" subtitle="Cases waiting for a BT, longest wait first, with how many ready people match each one." />
      <QueueTabs active="open-cases" />
      <div className="mb-4">
        <FilterTabs base="/queues/open-cases" param="state" value={state} options={[
          { value: "", label: "All", count: all.length },
          ...["NY", "NJ", "CO"].map((s) => ({ value: s, label: s, count: all.filter((r) => r.case.state === s).length })),
        ]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No open cases">Every case in this view is staffed.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ case: c, readyMatches, allMatches, top, backups }) => {
            const days = daysSince(c.waitingSince);
            return (
              <li key={c.id} data-row className="relative grid items-center gap-x-5 gap-y-3 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition hover:border-line-strong md:grid-cols-[minmax(0,14rem)_7rem_minmax(0,1fr)_minmax(0,13rem)_auto]">
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${days > 30 ? "bg-notready" : days > 14 ? "bg-case" : "bg-line-strong"}`} style={{ opacity: 0.35 + 0.65 * (days / maxDays) }} />
                <div className="flex min-w-0 items-center gap-3">
                  <CaseGlyph status={c.status} size={36} />
                  <div className="min-w-0">
                    <CaseLink id={c.id} code={c.code} />
                    <div className="truncate text-xs text-ink-3">{c.city}, {c.state}{c.status === "RESTAFFING" ? " · restaffing" : ""}</div>
                  </div>
                </div>
                <div><WaitPill days={days} /></div>
                <div className="min-w-0 text-xs text-ink-2">
                  <div className="truncate">{describeSlots(c.slots)} · ~{c.hoursPerWeek} hrs/wk</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.rbtRequired && <Badge className="ring-1 ring-inset ring-line-strong !bg-surface !text-ink">RBT required</Badge>}
                    {c.languageRequired && <Badge>{c.languageRequired}</Badge>}
                    {c.ageGroup && <Badge>{AGE_GROUP_LABELS[c.ageGroup] ?? c.ageGroup}</Badge>}
                    {backups > 0 && <Badge tone="restaff">{backups} backup{backups === 1 ? "" : "s"}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1.5">
                    {top.map((m) => <Avatar key={m.candidate.id} name={m.candidate.name} tone={personTone(m.candidate.kind, true)} size={28} />)}
                  </div>
                  <div className="text-xs leading-tight">
                    <div className={readyMatches === 0 ? "font-semibold text-notready-ink" : "font-semibold text-ink"}><span className="num">{readyMatches}</span> ready match{readyMatches === 1 ? "" : "es"}</div>
                    <div className="text-ink-3"><span className="num">{allMatches - readyMatches}</span> more not ready</div>
                  </div>
                </div>
                <Link href={`/cases/${c.id}${readyMatches === 0 ? "?show=all" : ""}`} className={buttonClass(canPlace && readyMatches > 0 ? "primary" : "secondary")}>
                  {readyMatches === 0 ? "Who is close" : canPlace ? "Staff it" : "View matches"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
