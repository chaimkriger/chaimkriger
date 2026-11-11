import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
import { Avatar, Badge, Card, cx, PageHeader, PersonLink, Table, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const user = await requireUser();
  if (!can(user.role, "integrations.manage")) redirect("/today");
  const C = HUBSPOT_PROPS.case;
  const [logs, mockCases, mockContacts, knownContacts, knownCases, awaitingHire, mockCaseCount] = await Promise.all([
    prisma.integrationLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.mockHubspotObject.findMany({ where: { objectType: "cases" }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.mockHubspotObject.count({ where: { objectType: "contacts" } }),
    prisma.person.count({ where: { hubspotContactId: { not: null } } }),
    prisma.case.count({ where: { hubspotId: { not: null } } }),
    prisma.person.findMany({ where: { kind: "APPLICANT", hiredAt: null, stage: "PAPERWORK_COMPLETE" }, take: 8, orderBy: { appliedAt: "asc" } }),
    prisma.mockHubspotObject.count({ where: { objectType: "cases" } }),
  ]);
  const systems: { name: string; mode: string; live: boolean; note: string }[] = [
    { name: "HubSpot", mode: config.hubspotMode, live: config.hubspotMode === "live", note: "Reads applicant contacts and cases; writes primary + backups to the case. Live adapter is written; switch with HUBSPOT_MODE=live." },
    { name: "Apploi", mode: config.apploiMode, live: false, note: "Applicants reach us through HubSpot. Mock only." },
    { name: "Salesmsg", mode: config.salesmsgMode, live: false, note: "Form-link and outreach texts. Mock only: nothing is really sent." },
    { name: "Workday", mode: config.workdayMode, live: false, note: 'Receives "hired" at POST /api/webhooks/workday. Mock payload shape.' },
    { name: "Intake source", mode: getIntakeSource().name, live: true, note: "Where new applicants come from. Swappable (INTAKE_SOURCE)." },
    { name: "Geocoder", mode: getGeocoder().name, live: false, note: "Knows the seeded ZIP codes only." },
    { name: "Drive time", mode: getDriveTimeProvider().name, live: false, note: "Straight-line estimate, not real traffic." },
  ];
  return (
    <>
      <PageHeader title="Integrations" subtitle="Which systems are mocked or live, a manual sync, and a log of everything that crossed the boundary." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {systems.map((s) => (
          <div key={s.name} data-system={s.name} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={cx("h-2 w-2 rounded-full", s.live ? "bg-ready" : "bg-case")} />
                {s.name}
              </span>
              <Badge tone={s.live ? "ready" : "case"}>{s.mode === "mock" ? "Test mode" : s.mode === "live" ? "Live" : s.mode}</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Sync now" hint="Pulls applicants and cases, and expires backups older than 30 days. The same job runs on a schedule through POST /api/cron/sync.">
          {config.hubspotMode === "mock" && (
            <p className="mb-3 rounded-xl bg-case-soft p-3 text-xs text-case-ink">
              Mock HubSpot holds {mockContacts} contacts ({Math.max(0, mockContacts - knownContacts)} not imported yet) and {mockCaseCount} cases ({Math.max(0, mockCaseCount - knownCases)} not imported yet).
            </p>
          )}
          <ActionButton variant="primary" size="md" action={runSyncAction}>Run sync</ActionButton>
        </Card>
        <Card title='Simulate Workday "hired"' hint="People whose paperwork is complete and who are waiting on Workday. Sends the same payload the webhook receives.">
          {awaitingHire.length === 0 ? <p className="text-sm text-ink-2">Nobody is waiting on a Workday hire.</p> : (
            <ul className="space-y-2">
              {awaitingHire.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2.5"><Avatar name={`${p.firstName} ${p.lastName}`} tone="notready" size={26} /><PersonLink id={p.id} name={`${p.firstName} ${p.lastName}`} /></span>
                  <ActionButton action={simulateWorkdayHireAction.bind(null, p.id)}>Mark hired</ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {config.hubspotMode === "mock" && (
        <div className="mt-6">
          <h2 className="mb-2 text-[0.93rem] font-semibold text-ink">Mock HubSpot: case records most recently written</h2>
          <Table head={["HubSpot id", C.code, C.status, C.primaryName, C.primaryPhone, C.backups, C.staffedAt]} empty={!mockCases.length}>
            {mockCases.map((m) => {
              const p = m.properties as Record<string, string>;
              return (
                <tr key={m.id}>
                  <Td className="num text-ink-2">{m.id}</Td>
                  <Td className="num font-medium">{p[C.code]}</Td>
                  <Td><Badge>{p[C.status]}</Badge></Td>
                  <Td>{p[C.primaryName] || <span className="text-ink-3">-</span>}</Td>
                  <Td className="num whitespace-nowrap text-ink-2">{p[C.primaryPhone] || "-"}</Td>
                  <Td className="whitespace-pre-line text-xs text-ink-2">{p[C.backups] || "-"}</Td>
                  <Td className="num whitespace-nowrap text-ink-2">{p[C.staffedAt] || "-"}</Td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-[0.93rem] font-semibold text-ink">Integration log <span className="font-normal text-ink-3">latest 40</span></h2>
        <Table head={["When (UTC)", "System", "", "Action", "Result", "Summary"]} empty={!logs.length}>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="num whitespace-nowrap text-xs text-ink-3">{l.createdAt.toISOString().replace("T", " ").slice(5, 19)}</Td>
              <Td className="font-medium capitalize">{l.system}</Td>
              <Td>{l.direction === "in" ? <ArrowDownLeft size={15} className="text-ink-3" aria-label="inbound" /> : <ArrowUpRight size={15} className="text-ink-3" aria-label="outbound" />}</Td>
              <Td className="whitespace-nowrap text-ink-2">{l.action}</Td>
              <Td><Badge tone={l.status === "ok" ? "ready" : l.status === "error" ? "notready" : "case"}>{l.status}</Badge></Td>
              <Td className="text-xs text-ink-2">{l.summary}</Td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
