import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { AGE_GROUP_LABELS, CERT_LABELS, CHECKLIST_ITEMS, STAGES, STAGE_LABELS } from "@/lib/constants";
import { slotsToHours } from "@/lib/availability";
import { formatMobile } from "@/lib/normalize";
import { checklistDone } from "@/lib/readiness";
import { readinessOf } from "@/lib/services/people";
import { topCasesForPerson } from "@/lib/services/queues";
import { resendFormLinkAction, setMilestoneAction, simulateWorkdayHireAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, CaseLink, CertBadge, fmtDate, KindBadge, PageHeader, ReadyBadge, SlotGrid, StageBadge } from "@/components/ui";
import { AgeGroupEditor, ChecklistToggle, NoteForm } from "./PersonControls";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const p = await prisma.person.findUnique({
    where: { id },
    include: {
      recruiter: true,
      assignments: { include: { case: true }, orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
      notes: { orderBy: { createdAt: "desc" }, include: { author: true } },
    },
  });
  if (!p) notFound();
  const canEdit = can(user.role, "pipeline.edit");
  const isAdmin = can(user.role, "integrations.manage");
  const readiness = readinessOf(p);
  const { row, matches } = await topCasesForPerson(p.id);
  const open = row?.candidate.openSlots ?? p.availability;
  const booked = p.availability.filter((s) => !open.includes(s));
  const now = new Date();
  const current = p.assignments.filter((a) => a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now));
  const past = p.assignments.filter((a) => !current.includes(a));
  const isApplicant = p.kind === "APPLICANT";
  const stageIndex = STAGES.indexOf(p.stage);
  const staffReady = p.kind === "STAFF" ? readiness.ready && open.length > 0 : readiness.ready;

  const milestones = [
    { key: "screened" as const, label: "Screened", at: p.screenedAt },
    { key: "applicationSent" as const, label: "Application sent", at: p.applicationSentAt },
    { key: "inServicesSent" as const, label: "In-services sent", at: p.inServicesSentAt },
  ];

  return (
    <>
      <PageHeader title={`${p.firstName} ${p.lastName}`} subtitle={[p.address ?? [p.city, p.state, p.zip].filter(Boolean).join(", "), formatMobile(p.mobile), p.email].filter(Boolean).join(" · ")}>
        <KindBadge kind={p.kind} />
        <ReadyBadge ready={staffReady} />
        {isApplicant && <StageBadge stage={p.stage} />}
        <CertBadge certification={p.certification} kind={p.kind} />
      </PageHeader>

      {isApplicant && (
        <ol className="mb-4 flex flex-wrap gap-1 text-xs" aria-label="Pipeline">
          {STAGES.map((s, i) => (
            <li key={s} className={`rounded-full px-2.5 py-1 ${i < stageIndex ? "bg-brand-100 text-brand-700" : i === stageIndex ? "bg-brand-600 font-semibold text-white" : "bg-slate-100 text-slate-500"}`}>
              {i + 1}. {STAGE_LABELS[s]}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={staffReady ? "Ready" : "Not ready: what is missing"} className={staffReady ? "border-green-200" : "border-red-200"}>
          {readiness.missing.length === 0 ? (
            <p className="text-sm text-slate-700">
              {p.kind === "STAFF"
                ? open.length ? "Current staff with open hours. Can be placed on another case." : "Current staff, fully booked. No open hours to place."
                : "Nothing missing. This person can be placed."}
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-800">
              {readiness.missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          {isApplicant && !p.formCompletedAt && canEdit && (
            <div className="mt-3"><ActionButton action={resendFormLinkAction.bind(null, p.id)}>Text the form link again</ActionButton></div>
          )}
        </Card>

        <Card title="Details">
          <dl className="space-y-1.5 text-sm">
            {[
              ["Certification", p.kind === "STAFF" ? (p.certification === "CERTIFIED" ? "RBT" : "BT") : CERT_LABELS[p.certification]],
              ["Max travel", `${p.maxTravelMinutes} min`],
              ["Has car", p.formCompletedAt ? (p.hasCar ? "Yes" : "No") : "-"],
              ["Languages", p.languages.join(", ") || "-"],
              ["Earliest start", fmtDate(p.earliestStart)],
              ["Applied", fmtDate(p.appliedAt)],
              ["Source", p.source],
              ["Recruiter", p.recruiter?.name ?? "-"],
              ["HubSpot contact", p.hubspotContactId ?? "-"],
              ["Workday", p.hiredAt ? `Hired ${fmtDate(p.hiredAt)} (${p.workdayEmployeeId ?? "no id"})` : "Not hired yet"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
          {isAdmin && isApplicant && !p.hiredAt && config.workdayMode === "mock" && (
            <div className="mt-3"><ActionButton action={simulateWorkdayHireAction.bind(null, p.id)}>Simulate Workday &quot;hired&quot;</ActionButton></div>
          )}
        </Card>

        <Card title="Availability">
          {p.availability.length ? (
            <>
              <SlotGrid slots={open} muted={booked} />
              <p className="mt-2 text-xs text-slate-500">
                Blue = open (~{slotsToHours(open)} hrs/wk){booked.length ? `, grey = booked on current cases (~${slotsToHours(booked)} hrs/wk)` : ""}.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No availability yet. It arrives with the form.</p>
          )}
        </Card>
      </div>

      {isApplicant && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Pipeline steps">
            <ul className="divide-y divide-slate-100 text-sm">
              <li className="flex items-center justify-between py-2">
                <span>Form completed</span>
                {p.formCompletedAt ? <Badge tone="green">✓ {fmtDate(p.formCompletedAt)}</Badge> : <Badge tone="amber">Waiting on applicant</Badge>}
              </li>
              {milestones.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-2 py-2">
                  <span>{m.label}</span>
                  <span className="flex items-center gap-2">
                    {m.at ? <Badge tone="green">✓ {fmtDate(m.at)}</Badge> : <Badge>Not yet</Badge>}
                    {canEdit && (
                      <ActionButton variant={m.at ? "ghost" : "primary"} action={setMilestoneAction.bind(null, p.id, m.key, !m.at)}>
                        {m.at ? "Undo" : `Mark ${m.label.toLowerCase()}`}
                      </ActionButton>
                    )}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between py-2">
                <span>Workday hire</span>
                {p.hiredAt ? <Badge tone="green">✓ {fmtDate(p.hiredAt)}</Badge> : <Badge>{config.requireWorkdayHire ? "Waiting on Workday" : "Not required"}</Badge>}
              </li>
            </ul>
          </Card>
          <Card title="Paperwork checklist">
            <ul className="space-y-1.5">
              {CHECKLIST_ITEMS.map((item) => (
                <li key={item.key}>
                  <ChecklistToggle personId={p.id} itemKey={item.key} label={item.label} group={item.group} done={checklistDone(p.checklist, item.key)} disabled={!canEdit} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Top matching open cases">
          {matches.length === 0 ? (
            <p className="text-sm text-slate-500">
              {!p.availability.length || p.lat == null ? "Needs availability and a location before cases can be matched." : open.length === 0 ? "No open hours." : "No open case within this person's travel limit and hours right now."}
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((m) => (
                <li key={m.caseId} className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="inline-block w-9 rounded bg-slate-800 px-1 text-center text-xs font-semibold tabular-nums text-white">{m.breakdown.total}</span>
                  <CaseLink id={m.caseId} code={m.code} />
                  <span className="text-xs text-slate-500">
                    {m.city}, {m.state} · {m.breakdown.driveMinutes} min · covers {m.breakdown.overlapSlots.length}/{m.breakdown.caseSlotCount} hours · requirements {m.breakdown.requirementsScore}/20
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!staffReady && matches.length > 0 && <p className="mt-2 text-xs text-slate-500">Shown for planning. This person cannot be placed as primary until they are ready.</p>}
        </Card>
        <Card title="Cases">
          {current.length === 0 && past.length === 0 && <p className="text-sm text-slate-500">Not attached to any case.</p>}
          <ul className="space-y-1 text-sm">
            {current.map((a) => (
              <li key={a.id}>
                <CaseLink id={a.case.id} code={a.case.code} /> <Badge tone={a.role === "PRIMARY" ? "green" : "violet"}>{a.role === "PRIMARY" ? "Primary" : "Backup"}</Badge>{" "}
                <span className="text-xs text-slate-500">since {fmtDate(a.createdAt)}{a.expiresAt ? ` · until ${fmtDate(a.expiresAt)}` : ""}</span>
              </li>
            ))}
            {past.map((a) => (
              <li key={a.id} className="text-slate-500">
                <CaseLink id={a.case.id} code={a.case.code} /> · {a.role.toLowerCase()} · ended {fmtDate(a.endedAt)} · {(a.endReason ?? a.status).replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Age group experience">
          <AgeGroupEditor personId={p.id} value={p.ageGroups} options={Object.entries(AGE_GROUP_LABELS).map(([value, label]) => ({ value, label }))} disabled={!canEdit} />
          <p className="mt-2 text-xs text-slate-500">Set at screening. Used for the requirements part of the match score.</p>
        </Card>
        <Card title="Texts">
          {p.messages.length === 0 ? <p className="text-sm text-slate-500">No texts yet.</p> : (
            <ul className="space-y-2 text-sm">
              {p.messages.map((m) => (
                <li key={m.id} className={`rounded-lg px-2.5 py-1.5 ${m.direction === "in" ? "mr-6 bg-slate-100" : "ml-6 bg-brand-50"}`}>
                  <div className="text-[11px] text-slate-500">{m.direction === "in" ? "Reply" : "Sent"} · {fmtDate(m.createdAt)}</div>
                  {m.body}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Notes">
          {canEdit && <NoteForm personId={p.id} />}
          <ul className="mt-3 space-y-2 text-sm">
            {p.notes.map((n) => (
              <li key={n.id} className="rounded bg-slate-50 p-2">
                <div className="text-[11px] text-slate-500">{n.author?.name ?? "Unknown"} · {fmtDate(n.createdAt)}</div>
                {n.body}
              </li>
            ))}
            {p.notes.length === 0 && <li className="text-slate-500">No notes.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
