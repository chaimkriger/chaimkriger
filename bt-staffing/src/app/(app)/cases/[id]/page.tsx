import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleDashed, MapPin, RefreshCw, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { AGE_GROUP_LABELS, MAX_BACKUPS } from "@/lib/constants";
import { formatMobile } from "@/lib/normalize";
import { loadCandidates, rankForCase } from "@/lib/services/matchingService";
import { readinessOf } from "@/lib/services/people";
import { sweepExpiredBackups } from "@/lib/services/assignments";
import { defaultOutreachBody } from "@/lib/services/outreach";
import { assignPrimaryAction, endAssignmentAction, retryHubSpotAction, setCaseStatusAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Avatar, Badge, Card, CaseGlyph, CaseStatusBadge, cx, daysSince, fmtDate, fmtShort, PageHeader, PersonLink, personTone, ScoreLegend, SlotGrid, WaitPill } from "@/components/ui";
import { placeConfirm } from "@/components/confirms";
import { type CandidateView, Workspace } from "./Workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await prisma.case.findUnique({ where: { id: (await params).id }, select: { code: true } });
  return { title: c?.code ?? "Case" };
}

export default async function CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string; focus?: string }> }) {
  const { id } = await params;
  const { show = "ready", focus } = await searchParams;
  const user = await requireUser();
  await sweepExpiredBackups();
  const now = new Date();
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      assignments: { include: { person: true, createdBy: true }, orderBy: { createdAt: "asc" } },
      campaigns: { orderBy: { createdAt: "desc" }, include: { recipients: { select: { status: true } } } },
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
  const byId = new Map(rows.map((r) => [r.person.id, r.person]));
  const attached = new Map(active.map((a) => [a.personId, a.role]));
  const ranked = outcome?.ranked ?? [];
  const readyCount = ranked.filter((m) => m.candidate.ready).length;
  // A person opened from the Place queue is always shown, even if not in the top slice.
  const showAll = show === "all" || (!!focus && ranked.some((m) => m.candidate.id === focus && !m.candidate.ready));
  const visible = (showAll ? ranked : ranked.filter((m) => m.candidate.ready)).slice(0, 40);
  const views: CandidateView[] = visible.map((m) => {
    const p = byId.get(m.candidate.id)!;
    return {
      id: p.id, name: m.candidate.name, kind: p.kind, ready: m.candidate.ready, certification: p.certification,
      openSlots: m.candidate.openSlots, attachedAs: attached.get(p.id) ?? null, breakdown: m.breakdown,
      lat: p.lat!, lng: p.lng!, city: p.city, mobile: formatMobile(p.mobile), hasCar: p.hasCar, languages: p.languages,
      missing: m.candidate.ready ? [] : readinessOf(p).missing,
    };
  });
  const rankOf = new Map(ranked.map((m, i) => [m.candidate.id, { rank: i + 1, m }]));

  const slot = "flex min-h-[4.25rem] items-center gap-3 rounded-xl border px-3 py-2.5";
  const team = (
    <Card
      title="Team on this case"
      hint={`One primary and up to ${MAX_BACKUPS} backups. Backups stay 30 days unless placed elsewhere.`}
      className={c.status === "RESTAFFING" && backups.length ? "border-restaff/50" : ""}
    >
      {c.status === "RESTAFFING" && backups.length > 0 && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-restaff-soft px-3 py-2 text-sm font-medium text-restaff-ink">
          <RefreshCw size={15} /> This case is restaffing. Offer it to these backups first.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className={cx(slot, "sm:col-span-2 lg:col-span-5", primary ? "border-staff/40 bg-staff-soft/40" : "border-dashed border-line-strong")} data-slot="primary">
          {primary ? (
            <>
              <Avatar name={`${primary.person.firstName} ${primary.person.lastName}`} tone="staff" size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[0.68rem] font-medium uppercase tracking-[0.07em] text-staff-ink">Primary BT</div>
                <PersonLink id={primary.person.id} name={`${primary.person.firstName} ${primary.person.lastName}`} />
                <div className="text-xs text-ink-3">Placed {fmtDate(primary.createdAt)}{primary.createdBy ? ` by ${primary.createdBy.name}` : ""}{primary.via === "outreach" ? " · from outreach" : ""}</div>
              </div>
              {canPlace && (
                <ActionButton variant="danger" action={endAssignmentAction.bind(null, primary.id)} confirm={{ title: "Remove the primary BT?", body: "The case moves to restaffing and HubSpot is updated. Backups stay attached.", confirmLabel: "Remove primary", danger: true }}>
                  Remove
                </ActionButton>
              )}
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-3"><CircleDashed size={18} /></span>
              <div>
                <div className="text-[0.68rem] font-medium uppercase tracking-[0.07em] text-ink-3">Primary BT</div>
                <div className="text-sm text-ink-2">{c.status === "DISCHARGED" ? "Case discharged." : "Open. Pick someone from the list below."}</div>
              </div>
            </>
          )}
        </div>
        {Array.from({ length: MAX_BACKUPS }, (_, i) => {
          const b = backups[i];
          if (!b) {
            return (
              <div key={i} className={cx(slot, "border-dashed border-line text-xs text-ink-3")} data-slot="backup-empty">
                Backup {i + 1}: open
              </div>
            );
          }
          const name = `${b.person.firstName} ${b.person.lastName}`;
          const r = rankOf.get(b.personId);
          const daysLeft = b.expiresAt ? Math.max(0, Math.ceil((b.expiresAt.getTime() - now.getTime()) / 86400_000)) : null;
          return (
            <div key={b.id} className={cx(slot, "flex-col !items-stretch border-restaff/40 bg-restaff-soft/40 lg:col-span-1")} data-slot="backup">
              <div className="flex items-center gap-2.5">
                <Avatar name={name} tone={personTone(b.person.kind, b.person.ready)} size={30} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm"><PersonLink id={b.person.id} name={name} /></div>
                  <div className="text-[0.7rem] text-ink-3">Backup · {daysLeft} days left</div>
                </div>
              </div>
              {open && <div className="text-[0.7rem] text-ink-2">{r ? `#${r.rank} in the list · ${r.m.breakdown.driveMinutes} min away` : "No longer fits the hours or travel limit"}</div>}
              {canPlace && (
                <div className="flex flex-wrap gap-1.5">
                  {open && <ActionButton variant="primary" confirm={placeConfirm(name, c.code)} action={assignPrimaryAction.bind(null, c.id, b.personId)} disabled={!b.person.ready} title={b.person.ready ? undefined : "Not ready yet"}>Place as primary</ActionButton>}
                  <ActionButton variant="ghost" action={endAssignmentAction.bind(null, b.id)}>Remove</ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  const rail = (
    <>
      <Card title="Hours needed" hint={`About ${c.hoursPerWeek} hours a week. Dark squares are the times a BT is needed.`}>
        <SlotGrid slots={c.slots} />
      </Card>
      <Card title="Requirements">
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-ink-2">RBT required</dt><dd className="font-medium">{c.rbtRequired ? "Yes" : "No"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-2">Language</dt><dd className="font-medium">{c.languageRequired ?? "No requirement"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-2">Age group</dt><dd className="font-medium">{c.ageGroup ? AGE_GROUP_LABELS[c.ageGroup] ?? c.ageGroup : "-"}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-ink-2">Assessment done</dt><dd className="font-medium">{fmtDate(c.assessmentCompletedAt)}</dd></div>
        </dl>
        {c.notes && <p className="mt-3 rounded-xl bg-raised p-3 text-sm text-ink-2">{c.notes}</p>}
      </Card>
      <Card title="Saved to HubSpot" hint="Who is on this case is copied to the case record in HubSpot." actions={<Badge tone={config.hubspotMode === "live" ? "ready" : "case"}>{config.hubspotMode === "live" ? "Live" : "Test mode"}</Badge>}>
        <div className="flex items-start gap-2.5 text-sm">
          {c.hubspotSyncStatus === "ok" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ready" /> : c.hubspotSyncStatus === "error" ? <TriangleAlert size={17} className="mt-0.5 shrink-0 text-notready" /> : <CircleDashed size={17} className="mt-0.5 shrink-0 text-ink-3" />}
          <div className="min-w-0">
            <div className="font-medium text-ink">
              {c.hubspotSyncStatus === "ok" ? `Saved ${fmtDate(c.hubspotSyncedAt)}` : c.hubspotSyncStatus === "error" ? "The last save did not go through" : c.hubspotSyncStatus === "skipped" ? "Skipped" : "Nothing saved yet"}
            </div>
            <div className="num text-xs text-ink-3">HubSpot record {c.hubspotId ?? "none"}</div>
            {c.hubspotSyncError && <p className="mt-1.5 rounded-lg bg-notready-soft p-2 text-xs text-notready-ink">{c.hubspotSyncError}</p>}
          </div>
        </div>
        {canPlace && c.hubspotId && <div className="mt-3"><ActionButton action={retryHubSpotAction.bind(null, c.id)}>Save to HubSpot again</ActionButton></div>}
      </Card>
      <Card title="Outreach">
        {c.campaigns.length === 0 ? (
          <p className="text-sm text-ink-2">No texts sent yet. Tick people in the list to text them about this case.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {c.campaigns.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2">
                <Link href={`/outreach/${k.id}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4">{fmtShort(k.createdAt)}</Link>
                <span className="text-xs text-ink-3">{k.recipients.length} texted · {k.recipients.filter((r) => r.status === "YES").length} yes</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {history.length > 0 && (
        <Card title="History">
          <ul className="space-y-2 text-sm">
            {history.map((a) => (
              <li key={a.id} className="leading-snug">
                <PersonLink id={a.person.id} name={`${a.person.firstName} ${a.person.lastName}`} />
                <div className="text-xs text-ink-3">{a.role.toLowerCase()} · {fmtShort(a.createdAt)} to {fmtShort(a.endedAt)} · {(a.endReason ?? a.status).replaceAll("_", " ")}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/cases" className="hover:text-ink">Cases</Link>}
        title={<span className="flex flex-wrap items-center gap-3"><CaseGlyph status={c.status} size={38} /><span className="num">{c.code}</span><CaseStatusBadge status={c.status} />{open && <WaitPill days={daysSince(c.waitingSince)} />}</span>}
        subtitle={<span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {c.clientLabel} · {c.address ?? [c.city, c.state].filter(Boolean).join(", ")}</span>}
      >
        {canStatus && c.status === "STAFFED" && (
          <ActionButton size="md" action={setCaseStatusAction.bind(null, c.id, "RESTAFFING")} confirm={{ title: "Move this case to restaffing?", body: "The primary BT comes off and HubSpot is updated. Backups stay attached and are shown first.", confirmLabel: "Move to restaffing" }}>
            Move to restaffing
          </ActionButton>
        )}
        {canStatus && c.status !== "DISCHARGED" && (
          <ActionButton size="md" variant="danger" action={setCaseStatusAction.bind(null, c.id, "DISCHARGED")} confirm={{ title: "Discharge this case?", body: "Everyone attached to it is released and it leaves the map and the queues.", confirmLabel: "Discharge", danger: true }}>
            Discharge
          </ActionButton>
        )}
        {canStatus && c.status === "DISCHARGED" && <ActionButton size="md" action={setCaseStatusAction.bind(null, c.id, "NEEDS_STAFFING")}>Reopen</ActionButton>}
      </PageHeader>

      {team}

      {open && outcome ? (
        <section className="mt-6" aria-label="Who could take this case">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Who could take this case</h2>
              <p className="mt-0.5 max-w-2xl text-xs text-ink-3">
                Best match first. On a tie, current staff come before new hires. Not shown: {outcome.excluded.over_max_travel} people who live further away than they said they would travel, {outcome.excluded.no_overlap} whose hours do not overlap, {outcome.excluded.no_location} with no address. This list only suggests; you choose who is placed.
              </p>
            </div>
            <div className="inline-flex gap-0.5 rounded-xl bg-sunken p-1 text-[0.82rem] font-medium">
              <Link href={`/cases/${c.id}`} scroll={false} className={cx("rounded-lg px-3 py-1.5", !showAll ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>Ready only <span className="num text-xs text-ink-3">{readyCount}</span></Link>
              <Link href={`/cases/${c.id}?show=all`} scroll={false} className={cx("rounded-lg px-3 py-1.5", showAll ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>Include not ready <span className="num text-xs text-ink-3">{ranked.length}</span></Link>
            </div>
          </div>
          <div className="mb-3"><ScoreLegend /></div>
          <Workspace
            caseId={c.id}
            caseCode={c.code}
            caseSlots={c.slots}
            center={c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null}
            restaffing={c.status === "RESTAFFING"}
            candidates={views}
            canPlace={canPlace}
            canOutreach={canOutreach}
            hasPrimary={!!primary}
            backupsFull={backups.length >= MAX_BACKUPS}
            defaultMessage={defaultOutreachBody(c)}
            focusId={focus ?? null}
            rail={rail}
          />
        </section>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rail}</div>
      )}
    </>
  );
}
