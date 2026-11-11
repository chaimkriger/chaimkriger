import { prisma } from "@/lib/db";
import { STAGES, STAGE_LABELS } from "@/lib/constants";
import { readinessOf } from "@/lib/services/people";
import { formatMobile } from "@/lib/normalize";
import { CertBadge, daysSince, FilterTabs, MissingList, PageHeader, PersonLink, ReadyBadge, StageBadge, Table, Td } from "@/components/ui";

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; state?: string }> }) {
  const { stage = "", q = "", state = "" } = await searchParams;
  const all = await prisma.person.findMany({
    where: { kind: "APPLICANT" },
    orderBy: { appliedAt: "desc" },
    include: { recruiter: true },
  });
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (p) =>
      (!stage || p.stage === stage) &&
      (!state || p.state === state) &&
      (!needle || `${p.firstName} ${p.lastName} ${p.email ?? ""} ${p.mobile ?? ""} ${p.zip ?? ""}`.toLowerCase().includes(needle)),
  );
  const stageOptions = STAGES.filter((s) => s !== "PLACED").map((s) => ({
    value: s,
    label: s === "APPLIED" ? "Form not completed" : STAGE_LABELS[s],
    count: all.filter((p) => p.stage === s).length,
  }));
  return (
    <>
      <PageHeader title="Applicants" subtitle="Everyone in the pipeline who has not been placed yet. Placed people move to Staff." />
      <div className="mb-3 space-y-2">
        <FilterTabs base="/applicants" param="stage" value={stage} extra={{ q, state }} options={[{ value: "", label: "All", count: all.length }, ...stageOptions]} />
        <form className="flex flex-wrap items-center gap-2" action="/applicants">
          {stage && <input type="hidden" name="stage" value={stage} />}
          <input name="q" defaultValue={q} placeholder="Search name, email, mobile, ZIP" className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm" />
          <select name="state" defaultValue={state} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="State">
            <option value="">All states</option>
            <option>NY</option><option>NJ</option><option>CO</option>
          </select>
          <button className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Search</button>
          <span className="text-sm text-slate-500">{rows.length} shown</span>
        </form>
      </div>
      <Table head={["Name", "Status", "Stage", "Missing", "Certification", "Location", "Mobile", "Applied", "Recruiter"]} empty={!rows.length}>
        {rows.map((p) => (
          <tr key={p.id}>
            <Td><PersonLink id={p.id} name={`${p.firstName} ${p.lastName}`} /></Td>
            <Td><ReadyBadge ready={p.ready} /></Td>
            <Td><StageBadge stage={p.stage} /></Td>
            <Td><MissingList missing={readinessOf(p).missing} max={2} /></Td>
            <Td><CertBadge certification={p.certification} /></Td>
            <Td className="whitespace-nowrap text-slate-600">{[p.city, p.state].filter(Boolean).join(", ") || "-"}</Td>
            <Td className="whitespace-nowrap text-slate-600">{formatMobile(p.mobile)}</Td>
            <Td className="whitespace-nowrap tabular-nums text-slate-600">{daysSince(p.appliedAt)}d ago</Td>
            <Td className="whitespace-nowrap text-slate-600">{p.recruiter?.name ?? "-"}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
