import { prisma } from "@/lib/db";
import { CASE_STATUS_LABELS } from "@/lib/constants";
import { describeSlots } from "@/lib/availability";
import { Badge, CaseLink, CaseStatusBadge, daysSince, FilterTabs, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ status?: string; state?: string }> }) {
  const { status = "", state = "" } = await searchParams;
  const now = new Date();
  const all = await prisma.case.findMany({
    orderBy: [{ status: "asc" }, { waitingSince: "asc" }],
    include: {
      assignments: {
        where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: { person: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  const rows = all.filter((c) => (!status || c.status === status) && (!state || c.state === state));
  return (
    <>
      <PageHeader title="Cases" subtitle="Cases are read from HubSpot. Open a case to see ranked candidates and make a placement." />
      <div className="mb-3 flex flex-wrap gap-4">
        <FilterTabs base="/cases" param="status" value={status} extra={{ state }} options={[
          { value: "", label: "All", count: all.length },
          ...Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({ value, label, count: all.filter((c) => c.status === value).length })),
        ]} />
        <FilterTabs base="/cases" param="state" value={state} extra={{ status }} options={[
          { value: "", label: "All states" }, { value: "NY", label: "NY" }, { value: "NJ", label: "NJ" }, { value: "CO", label: "CO" },
        ]} />
      </div>
      <Table head={["Case", "Status", "Location", "Hours needed", "Requirements", "Primary BT", "Backups", "Waiting"]} empty={!rows.length}>
        {rows.map((c) => {
          const primary = c.assignments.find((a) => a.role === "PRIMARY");
          const backups = c.assignments.filter((a) => a.role === "BACKUP").length;
          const open = c.status === "NEEDS_STAFFING" || c.status === "RESTAFFING";
          return (
            <tr key={c.id}>
              <Td><CaseLink id={c.id} code={c.code} /></Td>
              <Td><CaseStatusBadge status={c.status} /></Td>
              <Td className="whitespace-nowrap text-slate-600">{c.city}, {c.state}</Td>
              <Td className="max-w-52 text-xs text-slate-600">{describeSlots(c.slots)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.rbtRequired && <Badge tone="blue">RBT</Badge>}
                  {c.languageRequired && <Badge>{c.languageRequired}</Badge>}
                </div>
              </Td>
              <Td className="whitespace-nowrap">
                {primary ? <PersonLink id={primary.person.id} name={`${primary.person.firstName} ${primary.person.lastName}`} /> : <span className="text-slate-500">-</span>}
              </Td>
              <Td className="tabular-nums">{backups}</Td>
              <Td className="whitespace-nowrap tabular-nums text-slate-600">{open ? `${daysSince(c.waitingSince)} days` : "-"}</Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
