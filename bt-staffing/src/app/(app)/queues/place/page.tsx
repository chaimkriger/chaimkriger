import type { Metadata } from "next";
import Link from "next/link";
import { Car, Clock, Footprints } from "lucide-react";
import { placeQueue } from "@/lib/services/queues";
import { slotsToHours } from "@/lib/availability";
import { QueueTabs } from "@/components/QueueTabs";
import { matchLabel } from "@/lib/matching";
import { Avatar, Badge, CertBadge, EmptyState, FilterTabs, KindBadge, PageHeader, PersonLink, personTone, Ring, SlotGrid } from "@/components/ui";

export const metadata: Metadata = { title: "Place queue" };

export default async function PlacePage({ searchParams }: { searchParams: Promise<{ state?: string; kind?: string }> }) {
  const { state = "", kind = "" } = await searchParams;
  const all = await placeQueue();
  const rows = all.filter((r) => (!state || r.row.person.state === state) && (!kind || r.row.person.kind === kind));
  return (
    <>
      <PageHeader title="Place" subtitle="Everyone who can start now, with the three waiting cases they fit best. Tap a case to see the details and place them. Nobody is placed until you do it." />
      <QueueTabs active="place" />
      <div className="mb-4 flex flex-wrap gap-3">
        <FilterTabs base="/queues/place" param="kind" value={kind} extra={{ state }} options={[
          { value: "", label: "Everyone", count: all.length },
          { value: "APPLICANT", label: "New hires", count: all.filter((r) => r.row.person.kind === "APPLICANT").length },
          { value: "STAFF", label: "Current staff", count: all.filter((r) => r.row.person.kind === "STAFF").length },
        ]} />
        <FilterTabs base="/queues/place" param="state" value={state} extra={{ kind }} options={[
          { value: "", label: "All states" }, { value: "NY", label: "NY" }, { value: "NJ", label: "NJ" }, { value: "CO", label: "CO" },
        ]} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nobody ready in this view">Clear missing items in the Chase queue to fill this list.</EmptyState>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {rows.map(({ row, matches }) => {
            const p = row.person;
            return (
              <li key={p.id} data-row className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <Avatar name={row.candidate.name} tone={personTone(p.kind, true)} size={40} />
                  <div className="min-w-0 flex-1">
                    <PersonLink id={p.id} name={row.candidate.name} />
                    <div className="mt-1 flex flex-wrap gap-1">
                      <KindBadge kind={p.kind} />
                      <CertBadge certification={p.certification} kind={p.kind} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                      <span>{[p.city, p.state].filter(Boolean).join(", ")}</span>
                      <span className="inline-flex items-center gap-1">{p.hasCar ? <Car size={13} /> : <Footprints size={13} />} up to {p.maxTravelMinutes} min</span>
                      <span className="inline-flex items-center gap-1"><Clock size={13} /> ~{slotsToHours(row.candidate.openSlots)} hrs/wk open</span>
                    </div>
                  </div>
                  <div className="hidden sm:block" title="The times this person is free"><SlotGrid compact slots={row.candidate.openSlots} /></div>
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  {matches.length === 0 ? (
                    <p className="text-sm text-ink-3">No open case within reach right now.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-3">
                      {matches.slice(0, 3).map((m) => (
                        <li key={m.caseId}>
                          <Link href={`/cases/${m.caseId}?focus=${p.id}`} className="flex items-center gap-2.5 rounded-xl border border-line bg-raised p-2.5 transition hover:border-ink">
                            <Ring value={m.breakdown.total} size={36} />
                            <span className="min-w-0 leading-tight">
                              <span className="block truncate text-[0.8rem] font-semibold text-ink">{matchLabel(m.breakdown.total)}</span>
                              <span className="num block truncate text-[0.72rem] text-ink-2">{m.code}</span>
                              <span className="block truncate text-[0.7rem] text-ink-3">{m.breakdown.driveMinutes} min away{m.status === "RESTAFFING" ? " · restaffing" : ""}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {matches.length > 3 && <div className="mt-2"><Badge>+{matches.length - 3} more matching cases on the profile</Badge></div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
