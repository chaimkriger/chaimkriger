import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { formatMobile } from "@/lib/normalize";
import { chaseQueue } from "@/lib/services/queues";
import { NextStepButton } from "@/components/NextStepButton";
import { QueueTabs } from "@/components/QueueTabs";
import { Avatar, CaseLink, daysSince, EmptyState, FilterTabs, MissingList, PageHeader, PersonLink, Ring, StageBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Chase queue" };

// form + screened + application sent + in-services sent + checklist + availability + location + Workday
const TOTAL_STEPS = 4 + CHECKLIST_ITEMS.length + 3;

export default async function ChasePage({ searchParams }: { searchParams: Promise<{ state?: string; sort?: string }> }) {
  const { state = "", sort = "" } = await searchParams;
  const user = await requireUser();
  const canEdit = can(user.role, "pipeline.edit");
  const all = await chaseQueue();
  let rows = state ? all.filter((r) => r.person.state === state) : all;
  if (sort === "missing") rows = [...rows].sort((a, b) => a.missing.length - b.missing.length || (a.nearest?.miles ?? 999) - (b.nearest?.miles ?? 999));
  const count = (s: string) => all.filter((r) => r.person.state === s).length;
  return (
    <>
      <PageHeader title="Chase" subtitle="People who are not ready yet. Each row shows what is missing and the one thing to do next." />
      <QueueTabs active="chase" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs base="/queues/chase" param="state" value={state} extra={{ sort }} options={[
          { value: "", label: "All", count: all.length },
          { value: "NY", label: "NY", count: count("NY") },
          { value: "NJ", label: "NJ", count: count("NJ") },
          { value: "CO", label: "CO", count: count("CO") },
        ]} />
        <FilterTabs base="/queues/chase" param="sort" value={sort} extra={{ state }} options={[
          { value: "", label: "Nearest to a case" },
          { value: "missing", label: "Fewest missing" },
        ]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nobody to chase">Everyone in this view is ready.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ person: p, missing, nearest, step }) => {
            const name = `${p.firstName} ${p.lastName}`;
            const done = Math.max(0, TOTAL_STEPS - missing.length);
            return (
              <li key={p.id} data-row className="grid items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition hover:border-line-strong md:grid-cols-[minmax(0,15rem)_9.5rem_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={name} tone="notready" />
                  <div className="min-w-0">
                    <PersonLink id={p.id} name={name} />
                    <div className="truncate text-xs text-ink-3">
                      {formatMobile(p.mobile) || p.email} · applied {daysSince(p.appliedAt)}d ago
                    </div>
                  </div>
                </div>
                <div className="text-sm">
                  {nearest ? (
                    <>
                      <div className="flex items-center gap-1 font-medium text-ink"><MapPin size={13} className="text-ink-3" /><span className="num">{nearest.miles.toFixed(1)} mi</span></div>
                      <div className="text-xs text-ink-3">to <CaseLink id={nearest.id} code={nearest.code} /></div>
                    </>
                  ) : (
                    <div className="text-xs text-ink-3">No address yet,<br />distance unknown</div>
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <Ring value={done} max={TOTAL_STEPS} size={38} tone="notready" label={<span title={`${done} of ${TOTAL_STEPS} steps done`}>{missing.length}</span>} />
                  <div className="min-w-0">
                    <div className="mb-1"><StageBadge stage={p.stage} /></div>
                    <MissingList missing={missing} max={3} />
                  </div>
                </div>
                <div className="flex justify-start md:justify-end">
                  <NextStepButton personId={p.id} step={step} canEdit={canEdit} primary={step.oneClick} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
