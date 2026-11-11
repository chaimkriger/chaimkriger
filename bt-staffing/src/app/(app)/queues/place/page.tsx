import { placeQueue } from "@/lib/services/queues";
import { describeSlots, slotsToHours } from "@/lib/availability";
import { CaseLink, CertBadge, FilterTabs, KindBadge, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export default async function PlacePage({ searchParams }: { searchParams: Promise<{ state?: string; kind?: string }> }) {
  const { state = "", kind = "" } = await searchParams;
  const all = await placeQueue();
  const rows = all.filter((r) => (!state || r.row.person.state === state) && (!kind || r.row.person.kind === kind));
  return (
    <>
      <PageHeader title="Place queue" subtitle="Everyone who is ready, with their best open cases. Open a case to make the placement; the system never places anyone by itself." />
      <div className="mb-3 flex flex-wrap gap-4">
        <FilterTabs base="/queues/place" param="state" value={state} extra={{ kind }} options={[
          { value: "", label: "All states" }, { value: "NY", label: "NY" }, { value: "NJ", label: "NJ" }, { value: "CO", label: "CO" },
        ]} />
        <FilterTabs base="/queues/place" param="kind" value={kind} extra={{ state }} options={[
          { value: "", label: "Everyone", count: all.length },
          { value: "APPLICANT", label: "New hires", count: all.filter((r) => r.row.person.kind === "APPLICANT").length },
          { value: "STAFF", label: "Current staff", count: all.filter((r) => r.row.person.kind === "STAFF").length },
        ]} />
      </div>
      <Table head={["Person", "Type", "Open hours", "Top matching cases (score / drive / hours covered)"]} empty={!rows.length}>
        {rows.map(({ row, matches }) => (
          <tr key={row.person.id}>
            <Td>
              <PersonLink id={row.person.id} name={row.candidate.name} />
              <div className="text-xs text-slate-500">{[row.person.city, row.person.state].filter(Boolean).join(", ")} · up to {row.person.maxTravelMinutes} min</div>
            </Td>
            <Td>
              <div className="flex flex-col items-start gap-1">
                <KindBadge kind={row.person.kind} />
                <CertBadge certification={row.person.certification} kind={row.person.kind} />
              </div>
            </Td>
            <Td className="max-w-56 text-xs text-slate-600">
              <span className="font-medium text-slate-800">~{slotsToHours(row.candidate.openSlots)} hrs/wk</span>
              <div>{describeSlots(row.candidate.openSlots)}</div>
            </Td>
            <Td>
              {matches.length === 0 ? (
                <span className="text-sm text-slate-500">No open case within reach right now</span>
              ) : (
                <ul className="space-y-1">
                  {matches.slice(0, 3).map((m) => (
                    <li key={m.caseId} className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="inline-block w-9 rounded bg-slate-800 px-1 text-center text-xs font-semibold tabular-nums text-white">{m.breakdown.total}</span>
                      <CaseLink id={m.caseId} code={m.code} />
                      <span className="text-xs text-slate-500">
                        {m.city} · {m.breakdown.driveMinutes} min · {m.breakdown.overlapSlots.length}/{m.breakdown.caseSlotCount} hours
                        {m.status === "RESTAFFING" ? " · restaffing" : ""}
                      </span>
                    </li>
                  ))}
                  {matches.length > 3 && <li className="text-xs text-slate-500">+{matches.length - 3} more matching cases</li>}
                </ul>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
