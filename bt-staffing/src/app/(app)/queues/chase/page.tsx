import { chaseQueue } from "@/lib/services/queues";
import { CaseLink, daysSince, FilterTabs, MissingList, PageHeader, PersonLink, StageBadge, Table, Td } from "@/components/ui";
import { formatMobile } from "@/lib/normalize";

export default async function ChasePage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state = "" } = await searchParams;
  const all = await chaseQueue();
  const rows = state ? all.filter((r) => r.person.state === state) : all;
  const count = (s: string) => all.filter((r) => r.person.state === s).length;
  return (
    <>
      <PageHeader title="Chase queue" subtitle="People who are not ready yet, closest to an open case first. Clear what is missing to turn them green." />
      <div className="mb-3">
        <FilterTabs base="/queues/chase" param="state" value={state} options={[
          { value: "", label: "All", count: all.length },
          { value: "NY", label: "NY", count: count("NY") },
          { value: "NJ", label: "NJ", count: count("NJ") },
          { value: "CO", label: "CO", count: count("CO") },
        ]} />
      </div>
      <Table head={["Person", "Nearest open case", "Stage", "Missing", "Applied", "Mobile", "Recruiter"]} empty={!rows.length}>
        {rows.map(({ person: p, missing, nearest }) => (
          <tr key={p.id}>
            <Td>
              <PersonLink id={p.id} name={`${p.firstName} ${p.lastName}`} />
              <div className="text-xs text-slate-500">{[p.city, p.state].filter(Boolean).join(", ") || "No location"}</div>
            </Td>
            <Td className="whitespace-nowrap">
              {nearest ? (
                <>
                  <span className="font-medium tabular-nums">{nearest.miles.toFixed(1)} mi</span>{" "}
                  <span className="text-slate-400">to</span> <CaseLink id={nearest.id} code={nearest.code} />
                </>
              ) : (
                <span className="text-slate-500">Unknown (no location)</span>
              )}
            </Td>
            <Td><StageBadge stage={p.stage} /></Td>
            <Td><MissingList missing={missing} /></Td>
            <Td className="whitespace-nowrap tabular-nums text-slate-600">{daysSince(p.appliedAt)}d ago</Td>
            <Td className="whitespace-nowrap text-slate-600">{formatMobile(p.mobile)}</Td>
            <Td className="whitespace-nowrap text-slate-600">{p.recruiter?.name ?? "-"}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
