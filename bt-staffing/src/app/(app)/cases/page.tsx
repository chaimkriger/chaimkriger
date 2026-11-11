import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { CASE_STATUS_LABELS } from "@/lib/constants";
import { describeSlots } from "@/lib/availability";
import { Avatar, Badge, CaseGlyph, CaseLink, CaseStatusBadge, daysSince, FilterTabs, PageHeader, PersonLink, Table, Td, WaitPill } from "@/components/ui";

export const metadata: Metadata = { title: "Cases" };

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
      <PageHeader title="Cases" subtitle="Cases are read from HubSpot. Open one to see ranked candidates and make a placement." />
      <div className="mb-4 flex flex-wrap gap-3">
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
              <Td><span className="flex items-center gap-2 whitespace-nowrap"><CaseGlyph status={c.status} size={24} /><CaseLink id={c.id} code={c.code} /></span></Td>
              <Td><CaseStatusBadge status={c.status} /></Td>
              <Td className="whitespace-nowrap text-ink-2">{c.city}, {c.state}</Td>
              <Td className="max-w-52 text-xs text-ink-2">{describeSlots(c.slots)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.rbtRequired && <Badge className="ring-1 ring-inset ring-line-strong !bg-surface !text-ink">RBT</Badge>}
                  {c.languageRequired && <Badge>{c.languageRequired}</Badge>}
                </div>
              </Td>
              <Td className="whitespace-nowrap">
                {primary ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={`${primary.person.firstName} ${primary.person.lastName}`} tone="staff" size={22} />
                    <PersonLink id={primary.person.id} name={`${primary.person.firstName} ${primary.person.lastName}`} />
                  </span>
                ) : <span className="text-ink-3">-</span>}
              </Td>
              <Td className="num">{backups || <span className="text-ink-3">0</span>}</Td>
              <Td>{open ? <WaitPill days={daysSince(c.waitingSince)} /> : <span className="text-ink-3">-</span>}</Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
