import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { HUBSPOT_PROPS } from "@/lib/integrations/hubspot";
import { getDriveTimeProvider } from "@/lib/geo/drivetime";
import { getGeocoder } from "@/lib/geo/geocoder";
import { getIntakeSource } from "@/lib/intake/sources";
import { runSyncAction, simulateWorkdayHireAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!can(user.role, "integrations.manage")) redirect("/dashboard");
  const C = HUBSPOT_PROPS.case;
  const [logs, mockCases, mockContacts, knownContacts, knownCases, awaitingHire] = await Promise.all([
    prisma.integrationLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.mockHubspotObject.findMany({ where: { objectType: "cases" }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.mockHubspotObject.count({ where: { objectType: "contacts" } }),
    prisma.person.count({ where: { hubspotContactId: { not: null } } }),
    prisma.case.count({ where: { hubspotId: { not: null } } }),
    prisma.person.findMany({
      where: { kind: "APPLICANT", hiredAt: null, stage: "PAPERWORK_COMPLETE" },
      take: 8, orderBy: { appliedAt: "asc" },
    }),
  ]);
  const mockCaseCount = await prisma.mockHubspotObject.count({ where: { objectType: "cases" } });
  const mode = (m: string) => <Badge tone={m === "live" ? "green" : "amber"}>{m}</Badge>;
  const systems: [string, React.ReactNode, string][] = [
    ["HubSpot", mode(config.hubspotMode), "Reads applicant contacts and cases; writes primary + backups to the case. Live adapter is written; switch with HUBSPOT_MODE=live."],
    ["Apploi", mode(config.apploiMode), "Applicants reach us through HubSpot. Mock only."],
    ["Salesmsg", mode(config.salesmsgMode), "Form-link and outreach texts. Mock only: nothing is really sent."],
    ["Workday", mode(config.workdayMode), 'Receives "hired" at POST /api/webhooks/workday. Mock payload shape.'],
    ["Intake source", <Badge key="i">{getIntakeSource().name}</Badge>, "Where new applicants come from. Swappable (INTAKE_SOURCE)."],
    ["Geocoder", <Badge key="g" tone="amber">{getGeocoder().name}</Badge>, "Knows the seeded ZIP codes only."],
    ["Drive time", <Badge key="d" tone="amber">{getDriveTimeProvider().name}</Badge>, "Straight-line estimate, not real traffic."],
  ];
  return (
    <>
      <PageHeader title="Integrations" subtitle="Which systems are mocked or live, a manual sync, and a log of everything that crossed the boundary." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Systems">
          <ul className="divide-y divide-slate-100 text-sm">
            {systems.map(([name, badge, note]) => (
              <li key={name} className="flex items-start justify-between gap-3 py-2">
                <div><div className="font-medium">{name}</div><div className="text-xs text-slate-500">{note}</div></div>
                {badge}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Sync now">
            <p className="mb-3 text-sm text-slate-600">
              Pulls applicants from the intake source and cases from HubSpot, and expires backups older than 30 days. The same job runs on a schedule through POST /api/cron/sync.
            </p>
            {config.hubspotMode === "mock" && (
              <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-900">
                Mock HubSpot holds {mockContacts} contacts ({Math.max(0, mockContacts - knownContacts)} not imported yet) and {mockCaseCount} cases ({Math.max(0, mockCaseCount - knownCases)} not imported yet).
              </p>
            )}
            <ActionButton variant="primary" size="md" action={runSyncAction}>Run sync</ActionButton>
          </Card>
          <Card title='Simulate Workday "hired"'>
            <p className="mb-3 text-sm text-slate-600">People whose paperwork is complete and who are waiting on Workday. This sends the same payload the webhook receives.</p>
            {awaitingHire.length === 0 ? <p className="text-sm text-slate-500">Nobody is waiting on a Workday hire.</p> : (
              <ul className="space-y-2">
                {awaitingHire.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <PersonLink id={p.id} name={`${p.firstName} ${p.lastName}`} />
                    <ActionButton action={simulateWorkdayHireAction.bind(null, p.id)}>Mark hired</ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {config.hubspotMode === "mock" && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Mock HubSpot: case records most recently written</h2>
          <Table head={["HubSpot id", C.code, C.status, C.primaryName, C.primaryPhone, C.backups, C.staffedAt]} empty={!mockCases.length}>
            {mockCases.map((m) => {
              const p = m.properties as Record<string, string>;
              return (
                <tr key={m.id}>
                  <Td className="tabular-nums">{m.id}</Td>
                  <Td>{p[C.code]}</Td>
                  <Td>{p[C.status]}</Td>
                  <Td>{p[C.primaryName] || "-"}</Td>
                  <Td className="whitespace-nowrap">{p[C.primaryPhone] || "-"}</Td>
                  <Td className="whitespace-pre-line text-xs">{p[C.backups] || "-"}</Td>
                  <Td className="whitespace-nowrap">{p[C.staffedAt] || "-"}</Td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}

      <div className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Integration log (latest 40)</h2>
        <Table head={["When", "System", "Direction", "Action", "Result", "Summary"]} empty={!logs.length}>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap text-xs text-slate-600">{l.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</Td>
              <Td>{l.system}</Td>
              <Td>{l.direction === "in" ? "in" : "out"}</Td>
              <Td className="whitespace-nowrap">{l.action}</Td>
              <Td><Badge tone={l.status === "ok" ? "green" : l.status === "error" ? "red" : "amber"}>{l.status}</Badge></Td>
              <Td className="text-xs text-slate-700">{l.summary}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
