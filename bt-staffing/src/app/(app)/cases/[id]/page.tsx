import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { AGE_GROUP_LABELS, MAX_BACKUPS } from "@/lib/constants";
import { slotsToHours } from "@/lib/availability";
import { loadCandidates, rankForCase } from "@/lib/services/matchingService";
import { sweepExpiredBackups } from "@/lib/services/assignments";
import { defaultOutreachBody } from "@/lib/services/outreach";
import { endAssignmentAction, assignPrimaryAction, retryHubSpotAction, setCaseStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, CaseStatusBadge, daysSince, fmtDate, KindBadge, PageHeader, PersonLink, ReadyBadge, SlotGrid } from "@/components/ui";
import { CandidateTable, type CandidateView } from "./CandidateTable";

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  const { id } = await params;
  const { show = "ready" } = await searchParams;
  const user = await requireUser();
  await sweepExpiredBackups();
  const now = new Date();
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      assignments: { include: { person: true, createdBy: true }, orderBy: { createdAt: "asc" } },
      campaigns: { orderBy: { createdAt: "desc" }, include: { _count: { select: { recipients: true } } } },
    },
  });
  if (!c) notFound();

  const active = c.assignments.filter((a) => a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now));
  const primary = active.find((a) => a.role === "PRIMARY");
  const backups = active.filter((a) => a.role === "BACKUP");
  const history = c.assignments.filter((a) => !active.includes(a));
  const open = c.status === "NEEDS_STAFFING" || c.status === "RESTAFFING";
  const canPlace = can(user.role, "placement.make");
  const canStatus = can(user.role, "case.status");
  const canOutreach = can(user.role, "outreach.send");

  const rows = open ? await loadCandidates() : [];
  const outcome = open ? await rankForCase(c, rows) : null;
  const attached = new Map(active.map((a) => [a.personId, a.role]));
  const ranked = outcome?.ranked ?? [];
  const readyCount = ranked.filter((m) => m.candidate.ready).length;
  const visible = (show === "all" ? ranked : ranked.filter((m) => m.candidate.ready)).slice(0, 40);
  const views: CandidateView[] = visible.map((m) => ({
    id: m.candidate.id,
    name: m.candidate.name,
    kind: m.candidate.kind,
    ready: m.candidate.ready,
    certification: m.candidate.certification,
    openSlots: m.candidate.openSlots,
    attachedAs: attached.get(m.candidate.id) ?? null,
    breakdown: m.breakdown,
  }));
  const rankOf = new Map(ranked.map((m, i) => [m.candidate.id, { rank: i + 1, m }]));

  return (
    <>
      <PageHeader title={c.code} subtitle={`${c.clientLabel} · ${[c.address ?? c.city, !c.address ? c.state : null].filter(Boolean).join(", ")}`}>
        <CaseStatusBadge status={c.status} />
        {open && <Badge tone={daysSince(c.waitingSince) > 21 ? "red" : "slate"}>Waiting {daysSince(c.waitingSince)} days</Badge>}
        {canStatus && c.status === "STAFFED" && (
          <ActionButton variant="secondary" confirm="Move this case to restaffing? The primary BT comes off; backups stay." action={setCaseStatusAction.bind(null, c.id, "RESTAFFING")}>Move to restaffing</ActionButton>
        )}
        {canStatus && c.status !== "DISCHARGED" && (
          <ActionButton variant="danger" confirm="Discharge this case? Everyone attached to it is released." action={setCaseStatusAction.bind(null, c.id, "DISCHARGED")}>Discharge</ActionButton>
        )}
        {canStatus && c.status === "DISCHARGED" && (
          <ActionButton action={setCaseStatusAction.bind(null, c.id, "NEEDS_STAFFING")}>Reopen</ActionButton>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Hours needed">
          <SlotGrid slots={c.slots} />
          <p className="mt-2 text-xs text-slate-500">About {c.hoursPerWeek} hours a week ({c.slots.length} blocks of ~{slotsToHours(c.slots) / Math.max(1, c.slots.length)} hrs).</p>
        </Card>
        <Card title="Requirements">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">RBT required</dt><dd>{c.rbtRequired ? <Badge tone="blue">Yes</Badge> : "No"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Language</dt><dd>{c.languageRequired ?? "No requirement"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Age group</dt><dd>{c.ageGroup ? AGE_GROUP_LABELS[c.ageGroup] ?? c.ageGroup : "-"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Assessment done</dt><dd>{fmtDate(c.assessmentCompletedAt)}</dd></div>
          </dl>
          {c.notes && <p className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-700">{c.notes}</p>}
        </Card>
        <Card title="HubSpot write-back">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Mode</dt><dd><Badge tone={config.hubspotMode === "live" ? "green" : "amber"}>{config.hubspotMode}</Badge></dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">HubSpot record</dt><dd className="tabular-nums">{c.hubspotId ?? "none"}</dd></div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Last write</dt>
              <dd>
                {c.hubspotSyncStatus === "ok" ? <Badge tone="green">OK · {fmtDate(c.hubspotSyncedAt)}</Badge>
                  : c.hubspotSyncStatus === "error" ? <Badge tone="red">Failed</Badge>
                  : c.hubspotSyncStatus === "skipped" ? <Badge tone="amber">Skipped</Badge>
                  : <span className="text-slate-500">Nothing written yet</span>}
              </dd>
            </div>
          </dl>
          {c.hubspotSyncError && <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">{c.hubspotSyncError}</p>}
          {canPlace && c.hubspotId && (
            <div className="mt-3"><ActionButton action={retryHubSpotAction.bind(null, c.id)}>Write to HubSpot now</ActionButton></div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Primary BT">
          {primary ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <PersonLink id={primary.person.id} name={`${primary.person.firstName} ${primary.person.lastName}`} />
                <div className="text-xs text-slate-500">Placed {fmtDate(primary.createdAt)}{primary.createdBy ? ` by ${primary.createdBy.name}` : ""}{primary.via === "outreach" ? " (from outreach)" : ""}</div>
              </div>
              {canPlace && (
                <ActionButton variant="danger" confirm="Remove the primary BT? The case moves to restaffing." action={endAssignmentAction.bind(null, primary.id)}>Remove</ActionButton>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{c.status === "DISCHARGED" ? "Case discharged." : "No primary BT yet. Pick one from the ranked list below."}</p>
          )}
        </Card>
        <Card title={`Backups (${backups.length} of ${MAX_BACKUPS})`}>
          {c.status === "RESTAFFING" && backups.length > 0 && (
            <p className="mb-3 rounded bg-violet-50 px-2 py-1.5 text-sm text-violet-900">This case is restaffing. Offer it to these backups first.</p>
          )}
          {backups.length === 0 ? (
            <p className="text-sm text-slate-500">No backups attached.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {backups.map((b) => {
                const r = rankOf.get(b.personId);
                const daysLeft = b.expiresAt ? Math.max(0, Math.ceil((b.expiresAt.getTime() - now.getTime()) / 86400_000)) : null;
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <PersonLink id={b.person.id} name={`${b.person.firstName} ${b.person.lastName}`} />{" "}
                      <KindBadge kind={b.person.kind} /> <ReadyBadge ready={b.person.ready} />
                      <div className="text-xs text-slate-500">
                        Attached {fmtDate(b.createdAt)} · {daysLeft} days left
                        {open && (r ? ` · rank #${r.rank}, score ${r.m.breakdown.total}, ${r.m.breakdown.driveMinutes} min` : " · no longer matches this case's hours or travel limit")}
                      </div>
                    </div>
                    {canPlace && (
                      <div className="flex gap-1">
                        {open && <ActionButton variant="primary" confirm={`Place ${b.person.firstName} ${b.person.lastName} as primary on ${c.code}?`} action={assignPrimaryAction.bind(null, c.id, b.personId)}>Place as primary</ActionButton>}
                        <ActionButton variant="danger" action={endAssignmentAction.bind(null, b.id)}>Remove</ActionButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {open && outcome && (
        <div className="mt-4">
          <Card
            title="Ranked candidates"
            actions={
              <div className="flex gap-1 text-xs">
                <Link href={`/cases/${c.id}`} className={`rounded px-2 py-1 ${show !== "all" ? "bg-brand-600 text-white" : "ring-1 ring-slate-200"}`}>Ready only ({readyCount})</Link>
                <Link href={`/cases/${c.id}?show=all`} className={`rounded px-2 py-1 ${show === "all" ? "bg-brand-600 text-white" : "ring-1 ring-slate-200"}`}>Include not ready ({ranked.length})</Link>
              </div>
            }
          >
            <p className="mb-3 text-xs text-slate-500">
              Score = drive time (40) + hours covered (40) + requirements (20). Ties go to current staff. Left out: {outcome.excluded.over_max_travel} over their own travel limit, {outcome.excluded.no_overlap} with no overlapping hours, {outcome.excluded.no_location} with no map location. The list only ranks; you make the placement.
            </p>
            <CandidateTable
              caseId={c.id}
              caseCode={c.code}
              caseSlots={c.slots}
              candidates={views}
              canPlace={canPlace}
              canOutreach={canOutreach}
              hasPrimary={!!primary}
              backupsFull={backups.length >= MAX_BACKUPS}
              defaultMessage={defaultOutreachBody(c)}
            />
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Outreach for this case">
          {c.campaigns.length === 0 ? (
            <p className="text-sm text-slate-500">No texts sent yet. Tick people in the ranked list and send a "case starting near you" text.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {c.campaigns.map((k) => (
                <li key={k.id}>
                  <Link href={`/outreach/${k.id}`} className="font-medium text-brand-700 hover:underline">{fmtDate(k.createdAt)}</Link>{" "}
                  <span className="text-slate-500">· {k._count.recipients} texted</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Assignment history">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No past assignments.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {history.map((a) => (
                <li key={a.id}>
                  <PersonLink id={a.person.id} name={`${a.person.firstName} ${a.person.lastName}`} />{" "}
                  <span className="text-slate-500">
                    · {a.role.toLowerCase()} · {fmtDate(a.createdAt)} to {fmtDate(a.endedAt)} · {(a.endReason ?? a.status).replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
