import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Check, Clock, Footprints, Languages, Mail, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { AGE_GROUP_LABELS, CERT_LABELS, CHECKLIST_ITEMS } from "@/lib/constants";
import { slotsToHours } from "@/lib/availability";
import { formatMobile } from "@/lib/normalize";
import { nextStep } from "@/lib/nextStep";
import { checklistDone } from "@/lib/readiness";
import { readinessOf } from "@/lib/services/people";
import { topCasesForPerson } from "@/lib/services/queues";
import { setMilestoneAction, simulateWorkdayHireAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { NextStepButton } from "@/components/NextStepButton";
import { fitSummary, matchSentence } from "@/lib/matching";
import { Avatar, Badge, Card, CaseGlyph, CaseLink, CertBadge, cx, fmtDate, fmtShort, KindBadge, MatchWord, PageHeader, personTone, ReadyBadge, Ring, ScoreBar, SlotGrid, StageBadge, StepsProgress } from "@/components/ui";
import { AgeGroupEditor, ChecklistToggle, NoteForm } from "./PersonControls";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await prisma.person.findUnique({ where: { id: (await params).id }, select: { firstName: true, lastName: true } });
  return { title: p ? `${p.firstName} ${p.lastName}` : "Person" };
}

function Step({ done, current, title, date, children, action, id, last = false }: { done: boolean; current?: boolean; title: string; date?: string; children?: React.ReactNode; action?: React.ReactNode; id?: string; last?: boolean }) {
  return (
    <li id={id} className="relative flex scroll-mt-24 gap-3.5 pb-5 last:pb-0" data-step={title} data-done={done}>
      {!last && <span aria-hidden="true" className={cx("absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px", done ? "bg-ready" : "bg-line-strong")} />}
      <span className={cx("relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border-2", done ? "border-ready bg-ready text-white" : current ? "border-ink bg-surface" : "border-line-strong bg-surface")}>
        {done ? <Check size={13} strokeWidth={3.5} /> : current ? <span className="h-2 w-2 rounded-full bg-ink" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className={cx("text-sm", done ? "text-ink" : current ? "font-semibold text-ink" : "text-ink-2")}>{title}</span>
          <span className="flex items-center gap-2 text-xs text-ink-3">{date}{action}</span>
        </div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const p = await prisma.person.findUnique({
    where: { id },
    include: {
      recruiter: true,
      assignments: { include: { case: true }, orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" }, take: 30 },
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
  const isReady = p.kind === "STAFF" ? readiness.ready && open.length > 0 : readiness.ready;
  const name = `${p.firstName} ${p.lastName}`;
  const step = nextStep(p, config.requireWorkdayHire);
  const paperworkDone = CHECKLIST_ITEMS.filter((i) => checklistDone(p.checklist, i.key)).length;
  const totalSteps = 4 + CHECKLIST_ITEMS.length + 2 + (config.requireWorkdayHire ? 1 : 0);
  const doneSteps = Math.max(0, totalSteps - readiness.missing.length);

  const milestone = (key: "screened" | "applicationSent" | "inServicesSent", at: Date | null, label: string, isCurrent: boolean) => (
    <Step
      done={!!at} current={isCurrent} title={label} date={at ? fmtShort(at) : undefined}
      action={canEdit && (at
        ? <ActionButton variant="ghost" action={setMilestoneAction.bind(null, p.id, key, false)}>Undo</ActionButton>
        : <ActionButton variant={isCurrent ? "primary" : "secondary"} action={setMilestoneAction.bind(null, p.id, key, true)}>Mark {label.toLowerCase()}</ActionButton>)}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={<Link href={isApplicant ? "/applicants" : "/staff"} className="hover:text-ink">{isApplicant ? "Pipeline" : "Staff"}</Link>}
        title={
          <span className="flex flex-wrap items-center gap-4">
            <Avatar name={name} tone={personTone(p.kind, isReady)} size={52} />
            <span>
              {name}
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <KindBadge kind={p.kind} />
                <ReadyBadge ready={isReady} />
                {isApplicant && <StageBadge stage={p.stage} />}
                <CertBadge certification={p.certification} kind={p.kind} />
              </span>
            </span>
          </span>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        {p.mobile && <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-ink-3" /><span className="num">{formatMobile(p.mobile)}</span></span>}
        {p.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-ink-3" />{p.email}</span>}
        <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-ink-3" />{p.address ?? ([p.city, p.state, p.zip].filter(Boolean).join(", ") || "No address yet")}</span>
        {p.formCompletedAt && <span className="inline-flex items-center gap-1.5">{p.hasCar ? <Car size={14} className="text-ink-3" /> : <Footprints size={14} className="text-ink-3" />}{p.hasCar ? "Has a car" : "No car"} · up to {p.maxTravelMinutes} min</span>}
        {p.languages.length > 0 && <span className="inline-flex items-center gap-1.5"><Languages size={14} className="text-ink-3" />{p.languages.join(", ")}</span>}
      </div>

      {/* Status banner: what is going on with this person and the one thing to do */}
      <div className={cx("mb-5 flex flex-wrap items-center gap-4 rounded-2xl border p-4", isReady ? "border-ready/30 bg-ready-soft" : p.kind === "STAFF" ? "border-line bg-surface" : "border-notready/25 bg-notready-soft")} data-banner>
        {isApplicant && <div className="w-36"><StepsProgress done={doneSteps} total={totalSteps} tone={isReady ? "ready" : "notready"} /></div>}
        <div className="min-w-0 flex-1">
          <div className="text-[0.95rem] font-semibold text-ink">
            {p.kind === "STAFF"
              ? open.length ? "Current staff with open hours. Can take another case." : "Current staff, fully booked."
              : isReady ? "Nothing missing. This person can be placed." : `Not ready: ${readiness.missing.length} thing${readiness.missing.length === 1 ? "" : "s"} missing`}
          </div>
          {!isReady && readiness.missing.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Missing items">
              {readiness.missing.map((m) => <li key={m} className="rounded-md bg-surface/80 px-2 py-0.5 text-xs text-notready-ink">{m}</li>)}
            </ul>
          )}
        </div>
        {isApplicant && !isReady && <NextStepButton personId={p.id} step={step} canEdit={canEdit} size="md" primary />}
        {isAdmin && isApplicant && !p.hiredAt && config.workdayMode === "mock" && (
          <ActionButton size="md" action={simulateWorkdayHireAction.bind(null, p.id)}>Simulate Workday &quot;hired&quot;</ActionButton>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {isApplicant && (
            <Card title="Journey" hint="Each step in order. The stage moves forward on its own as steps are completed.">
              <ol>
                <Step done title="Applied" date={fmtShort(p.appliedAt)} />
                <Step done={!!p.formCompletedAt} current={!p.formCompletedAt} title="Form completed" date={p.formCompletedAt ? fmtShort(p.formCompletedAt) : "Waiting on applicant"} />
                {milestone("screened", p.screenedAt, "Screened", step.key === "screened")}
                {milestone("applicationSent", p.applicationSentAt, "Application sent", step.key === "applicationSent")}
                {milestone("inServicesSent", p.inServicesSentAt, "In-services sent", step.key === "inServicesSent")}
                <Step id="paperwork" done={paperworkDone === CHECKLIST_ITEMS.length} current={step.key === "paperwork"} title="Paperwork complete" date={`${paperworkDone} of ${CHECKLIST_ITEMS.length}`}>
                  <ul className="grid gap-x-3 sm:grid-cols-2" aria-label="Paperwork checklist">
                    {CHECKLIST_ITEMS.map((item) => (
                      <li key={item.key}>
                        <ChecklistToggle personId={p.id} itemKey={item.key} label={item.label} done={checklistDone(p.checklist, item.key)} disabled={!canEdit} />
                      </li>
                    ))}
                  </ul>
                </Step>
                {config.requireWorkdayHire && <Step done={!!p.hiredAt} current={step.key === "workday"} title="Hired in Workday" date={p.hiredAt ? `${fmtShort(p.hiredAt)}${p.workdayEmployeeId ? ` · ${p.workdayEmployeeId}` : ""}` : "Waiting on Workday"} />}
                <Step done={readiness.ready} title="Ready to place" last />
              </ol>
            </Card>
          )}

          <Card title={p.kind === "STAFF" ? "Cases" : "Attached to"}>
            {current.length === 0 && past.length === 0 && <p className="text-sm text-ink-2">Not attached to any case.</p>}
            <ul className="space-y-2.5 text-sm">
              {current.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5">
                  <CaseGlyph status={a.case.status} size={26} />
                  <CaseLink id={a.case.id} code={a.case.code} />
                  <Badge tone={a.role === "PRIMARY" ? "staff" : "restaff"}>{a.role === "PRIMARY" ? "Primary" : "Backup"}</Badge>
                  <span className="text-xs text-ink-3">since {fmtShort(a.createdAt)}{a.expiresAt ? ` · until ${fmtShort(a.expiresAt)}` : ""}</span>
                </li>
              ))}
              {past.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 text-ink-3">
                  <CaseLink id={a.case.id} code={a.case.code} />
                  <span className="text-xs">{a.role.toLowerCase()} · ended {fmtShort(a.endedAt)} · {(a.endReason ?? a.status).replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Texts" hint={config.salesmsgMode === "mock" ? "Salesmsg is mocked: nothing is really sent." : undefined}>
            {p.messages.length === 0 ? <p className="text-sm text-ink-2">No texts yet.</p> : (
              <ul className="space-y-2 text-sm">
                {p.messages.map((m) => (
                  <li key={m.id} className={cx("flex", m.direction === "in" ? "justify-start" : "justify-end")}>
                    <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2", m.direction === "in" ? "rounded-bl-md bg-sunken text-ink" : "rounded-br-md bg-inverse text-inverse-ink")}>
                      {m.body}
                      <div className={cx("mt-1 text-[0.66rem]", m.direction === "in" ? "text-ink-3" : "text-inverse-ink/60")}>{m.direction === "in" ? "Reply" : "Sent"} · {fmtShort(m.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            title="Best open cases for this person"
            hint={!isReady && matches.length > 0 ? "For planning. They cannot be placed as primary until they are ready." : undefined}
          >
            {matches.length === 0 ? (
              <p className="text-sm text-ink-2">
                {!p.availability.length || p.lat == null ? "Needs availability and an address before cases can be matched." : open.length === 0 ? "No open hours." : "No open case within this person's travel limit and hours right now."}
              </p>
            ) : (
              <ul className="space-y-2" data-matches>
                {matches.map((m) => (
                  <li key={m.caseId}>
                    <Link href={`/cases/${m.caseId}?focus=${p.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-ink">
                      <Ring value={m.breakdown.total} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm">
                          <MatchWord total={m.breakdown.total} />
                          <span className="num font-medium text-ink">{m.code}</span>
                          <span className="text-xs text-ink-3">{m.city}, {m.state}{m.status === "RESTAFFING" ? " · restaffing" : ""}</span>
                        </div>
                        <div className="mt-1.5"><ScoreBar drive={m.breakdown.driveScore} availability={m.breakdown.availabilityScore} requirements={m.breakdown.requirementsScore} /></div>
                        <div className="mt-1 text-[0.72rem] text-ink-2">{matchSentence(m.breakdown)} · {fitSummary(m.breakdown.requirements).text}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Availability" hint={p.availability.length ? `About ${slotsToHours(open)} open hours a week${booked.length ? `, ${slotsToHours(booked)} booked` : ""}` : undefined}>
            {p.availability.length ? (
              <>
                <SlotGrid slots={open} muted={booked} />
                {booked.length > 0 && <p className="mt-2 text-xs text-ink-3">Dark = open. Hatched = booked on current cases.</p>}
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-2"><Clock size={15} /> Arrives with the form.</p>
            )}
          </Card>

          <Card title="Details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Certification", p.kind === "STAFF" ? (p.certification === "CERTIFIED" ? "RBT" : "BT") : CERT_LABELS[p.certification]],
                ["Earliest start", fmtDate(p.earliestStart)],
                ["Applied", fmtDate(p.appliedAt)],
                ["Recruiter", p.recruiter?.name ?? "-"],
                ["Source", p.source],
                ["HubSpot contact", p.hubspotContactId ?? "-"],
                ["Workday", p.hiredAt ? `Hired ${fmtShort(p.hiredAt)}` : "Not hired yet"],
                ["Workday id", p.workdayEmployeeId ?? "-"],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-ink-3">{k}</dt><dd className="mt-0.5 truncate text-ink">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <div className="mb-2 text-xs text-ink-3">Age group experience (set at screening; used in the match score)</div>
              <AgeGroupEditor personId={p.id} value={p.ageGroups} options={Object.entries(AGE_GROUP_LABELS).map(([value, label]) => ({ value, label }))} disabled={!canEdit} />
            </div>
          </Card>

          <Card title="Notes">
            {canEdit && <NoteForm personId={p.id} />}
            <ul className="mt-3 space-y-2 text-sm">
              {p.notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-raised p-3">
                  {n.body}
                  <div className="mt-1 text-[0.7rem] text-ink-3">{n.author?.name ?? "Unknown"} · {fmtShort(n.createdAt)}</div>
                </li>
              ))}
              {p.notes.length === 0 && <li className="text-ink-3">No notes yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
