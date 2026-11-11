import { openCasesQueue } from "@/lib/services/queues";
import { describeSlots } from "@/lib/availability";
import { AGE_GROUP_LABELS } from "@/lib/constants";
import { Badge, CaseLink, CaseStatusBadge, daysSince, FilterTabs, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export default async function OpenCasesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state = "" } = await searchParams;
  const all = await openCasesQueue();
  const rows = (state ? all.filter((r) => r.case.state === state) : all).sort(
    (a, b) => a.case.waitingSince.getTime() - b.case.waitingSince.getTime(),
  );
  return (
    <>
      <PageHeader title="Open cases" subtitle="Cases waiting for a BT, longest wait first, with the number of ready people who match." />
      <div className="mb-3">
        <FilterTabs base="/queues/open-cases" param="state" value={state} options={[
          { value: "", label: "All", count: all.length },
          ...["NY", "NJ", "CO"].map((s) => ({ value: s, label: s, count: all.filter((r) => r.case.state === s).length })),
        ]} />
      </div>
      <Table head={["Case", "Status", "Days waiting", "Ready matches", "Best ready match", "Backups", "Hours needed", "Requirements"]} empty={!rows.length}>
        {rows.map(({ case: c, readyMatches, allMatches, best, backups }) => {
          const days = daysSince(c.waitingSince);
          return (
            <tr key={c.id}>
              <Td>
                <CaseLink id={c.id} code={c.code} />
                <div className="text-xs text-slate-500">{c.city}, {c.state}</div>
              </Td>
              <Td><CaseStatusBadge status={c.status} /></Td>
              <Td className="whitespace-nowrap">
                <span className={`font-semibold tabular-nums ${days > 21 ? "text-red-700" : "text-slate-900"}`}>{days}</span>
                <span className="text-slate-500"> days</span>
              </Td>
              <Td className="whitespace-nowrap">
                <span className={`font-semibold tabular-nums ${readyMatches === 0 ? "text-red-700" : "text-slate-900"}`}>{readyMatches}</span>
                <span className="text-xs text-slate-500"> ready · {allMatches - readyMatches} not ready</span>
              </Td>
              <Td className="whitespace-nowrap">
                {best ? (
                  <>
                    <PersonLink id={best.candidate.id} name={best.candidate.name} />
                    <span className="text-xs text-slate-500"> · score {best.breakdown.total}</span>
                  </>
                ) : (
                  <span className="text-slate-500">None yet</span>
                )}
              </Td>
              <Td className="tabular-nums">{backups}</Td>
              <Td className="max-w-48 text-xs text-slate-600">{describeSlots(c.slots)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.rbtRequired && <Badge tone="blue">RBT required</Badge>}
                  {c.languageRequired && <Badge>{c.languageRequired}</Badge>}
                  {c.ageGroup && <Badge>{AGE_GROUP_LABELS[c.ageGroup] ?? c.ageGroup}</Badge>}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
