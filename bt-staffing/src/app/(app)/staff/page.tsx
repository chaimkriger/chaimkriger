import type { Metadata } from "next";
import { loadCandidates } from "@/lib/services/matchingService";
import { slotsToHours } from "@/lib/availability";
import { Avatar, Badge, CaseLink, CertBadge, FilterTabs, PageHeader, PersonLink, SlotGrid, Table, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Staff" };

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
      <div className="mb-4 flex flex-wrap gap-3">
        <FilterTabs base="/staff" param="open" value={open} extra={{ state }} options={[
          { value: "", label: "Everyone", count: all.length },
          { value: "yes", label: "Has open hours", count: all.filter((r) => r.candidate.openSlots.length > 0).length },
          { value: "no", label: "Fully booked", count: all.filter((r) => r.candidate.openSlots.length === 0).length },
        ]} />
        <FilterTabs base="/staff" param="state" value={state} extra={{ open }} options={[
          { value: "", label: "All states" },
          ...["NY", "NJ", "CO"].map((s) => ({ value: s, label: s, count: all.filter((r) => r.person.state === s).length })),
        ]} />
      </div>
      <Table head={["Name", "Credential", "Location", "Current cases", "Open availability", "Week", "Languages"]} empty={!rows.length}>
        {rows.map(({ person: p, candidate, currentCases }) => {
          const booked = p.availability.filter((s) => !candidate.openSlots.includes(s));
          return (
            <tr key={p.id}>
              <Td>
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Avatar name={candidate.name} tone={candidate.openSlots.length ? "staff" : "neutral"} size={28} />
                  <PersonLink id={p.id} name={candidate.name} />
                </span>
              </Td>
              <Td><CertBadge certification={p.certification} kind="STAFF" /></Td>
              <Td className="whitespace-nowrap text-ink-2">{p.city}, {p.state}</Td>
              <Td>
                {currentCases.length ? (
                  <div className="flex flex-col gap-0.5">
                    {currentCases.map((c) => (
                      <span key={c.id} className="whitespace-nowrap">
                        <CaseLink id={c.id} code={c.code} /> <span className="text-xs text-ink-3">~{slotsToHours(c.slots)} hrs/wk</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-ink-3">No current case</span>
                )}
              </Td>
              <Td>
                {candidate.openSlots.length ? <Badge tone="staff">~{slotsToHours(candidate.openSlots)} hrs/wk open</Badge> : <Badge>Fully booked</Badge>}
              </Td>
              <Td><SlotGrid compact slots={candidate.openSlots} muted={booked} /></Td>
              <Td className="text-xs text-ink-2">{p.languages.join(", ")}</Td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-3 text-xs text-ink-3">Week: dark squares are open hours, hatched squares are booked on current cases.</p>
    </>
  );
}
