import { loadCandidates } from "@/lib/services/matchingService";
import { describeSlots, slotsToHours } from "@/lib/availability";
import { Badge, CaseLink, CertBadge, FilterTabs, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ state?: string; open?: string }> }) {
  const { state = "", open = "" } = await searchParams;
  const all = (await loadCandidates()).filter((r) => r.person.kind === "STAFF");
  const rows = all.filter(
    (r) =>
      (!state || r.person.state === state) &&
      (!open || (open === "yes" ? r.candidate.openSlots.length > 0 : r.candidate.openSlots.length === 0)),
  );
  return (
    <>
      <PageHeader title="Staff" subtitle="Active BTs and RBTs, the cases they are on, and the hours they still have open." />
      <div className="mb-3 flex flex-wrap gap-4">
        <FilterTabs base="/staff" param="state" value={state} extra={{ open }} options={[
          { value: "", label: "All states", count: all.length },
          ...["NY", "NJ", "CO"].map((s) => ({ value: s, label: s, count: all.filter((r) => r.person.state === s).length })),
        ]} />
        <FilterTabs base="/staff" param="open" value={open} extra={{ state }} options={[
          { value: "", label: "Any availability" },
          { value: "yes", label: "Has open hours", count: all.filter((r) => r.candidate.openSlots.length > 0).length },
          { value: "no", label: "Fully booked", count: all.filter((r) => r.candidate.openSlots.length === 0).length },
        ]} />
      </div>
      <Table head={["Name", "Credential", "Location", "Current cases", "Open availability", "Languages"]} empty={!rows.length}>
        {rows.map(({ person: p, candidate, currentCases }) => (
          <tr key={p.id}>
            <Td><PersonLink id={p.id} name={candidate.name} /></Td>
            <Td><CertBadge certification={p.certification} kind="STAFF" /></Td>
            <Td className="whitespace-nowrap text-slate-600">{p.city}, {p.state}</Td>
            <Td>
              {currentCases.length ? (
                <div className="flex flex-col gap-0.5">
                  {currentCases.map((c) => (
                    <span key={c.id} className="whitespace-nowrap">
                      <CaseLink id={c.id} code={c.code} /> <span className="text-xs text-slate-500">~{slotsToHours(c.slots)} hrs/wk</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">No current case</span>
              )}
            </Td>
            <Td className="max-w-72 text-xs text-slate-600">
              {candidate.openSlots.length ? (
                <>
                  <Badge tone="blue">~{slotsToHours(candidate.openSlots)} hrs/wk open</Badge>
                  <div className="mt-1">{describeSlots(candidate.openSlots)}</div>
                </>
              ) : (
                <Badge>Fully booked</Badge>
              )}
            </Td>
            <Td className="text-xs text-slate-600">{p.languages.join(", ")}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
