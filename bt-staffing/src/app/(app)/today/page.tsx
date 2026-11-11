import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquareText, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { todayData } from "@/lib/services/today";
import { buttonClass } from "@/components/button";
import { NextStepButton } from "@/components/NextStepButton";
import { Avatar, Badge, Card, CaseGlyph, CaseLink, EmptyState, fmtShort, MissingList, PageHeader, PersonLink, personTone, Ring, Stat, WaitPill } from "@/components/ui";

export const metadata: Metadata = { title: "Today" };

function greeting() {
  // Recruiters are on US Eastern time for most of the day.
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function TodayPage() {
  const user = await requireUser();
  const d = await todayData();
  const canPlace = can(user.role, "placement.make");
  const canEdit = can(user.role, "pipeline.edit");
  const first = user.name.split(" ")[0];
  const headline = canPlace
    ? d.placeable.length
      ? `${d.placeable.length} waiting ${d.placeable.length === 1 ? "case has" : "cases have"} someone ready right now.`
      : "No case has a ready match yet. Chasing is the fastest way to change that."
    : `${d.almostReady.length} ${d.almostReady.length === 1 ? "person is" : "people are"} one or two steps from ready.`;

  const almost = (
    <Card
      title="Closest to ready"
      hint="One or two things left. Clearing these turns red pins green."
      actions={<Link href="/queues/chase?sort=missing" className={buttonClass("ghost")}>Chase queue <ArrowRight size={14} /></Link>}
      flush
    >
      {d.almostReady.length === 0 ? (
        <div className="p-5"><EmptyState title="Nobody is this close yet">Work the Chase queue to move people along.</EmptyState></div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {d.almostReady.slice(0, 7).map(({ person: p, missing, miles, step }) => {
            const name = `${p.firstName} ${p.lastName}`;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                <Avatar name={name} tone="notready" size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <PersonLink id={p.id} name={name} />
                    <span className="text-xs text-ink-3">{p.city ?? "No location"}{miles != null ? ` · ${miles.toFixed(1)} mi to a case` : ""}</span>
                  </div>
                  <div className="mt-1"><MissingList missing={missing} /></div>
                </div>
                <NextStepButton personId={p.id} step={step} canEdit={canEdit} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const placeable = (
    <Card
      title="Ready to staff now"
      hint="Longest-waiting cases that already have a ready match."
      actions={<Link href="/queues/open-cases" className={buttonClass("ghost")}>All open cases <ArrowRight size={14} /></Link>}
      flush
    >
      {d.placeable.length === 0 ? (
        <div className="p-5"><EmptyState title="No case has a ready match">Everyone ready is too far away or has no matching hours.</EmptyState></div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {d.placeable.slice(0, 6).map(({ case: c, days, readyCount, top }) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <CaseGlyph status={c.status} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CaseLink id={c.id} code={c.code} />
                  <WaitPill days={days} />
                  {c.status === "RESTAFFING" && <Badge tone="restaff">Restaffing</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-3">
                  {c.city}, {c.state} · best: {top[0].name} ({top[0].driveMinutes} min away)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-1.5" title={`${readyCount} ready matches`}>
                  {top.map((t) => <Avatar key={t.id} name={t.name} tone={personTone(t.kind, true)} size={26} />)}
                </div>
                <Ring value={top[0].total} size={38} />
                <Link href={`/cases/${c.id}`} className={buttonClass(canPlace ? "primary" : "secondary")}>{canPlace ? "Staff it" : "View"}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" })}
        title={`${greeting()}, ${first}.`}
        subtitle={headline}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cases waiting" tone="case" value={d.stats.openCases} note={d.stats.over30 ? `${d.stats.over30} waiting over 30 days` : `Average ${d.stats.avgWait} days`} href="/queues/open-cases" />
        <Stat label="Ready to place" tone="ready" value={d.stats.readyApplicants} note="New hires with nothing missing" href="/queues/place" />
        <Stat label="Still to chase" tone="notready" value={d.stats.notReady} note={d.formWaiting ? `${d.formWaiting} have sat on the form 3+ days` : "Not ready yet"} href="/queues/chase" />
        <Stat label="Placements this month" tone="staff" value={d.stats.placementsThisMonth} note="Primary placements" href="/dashboard" />
      </div>

      {(d.toConfirm.length > 0 || d.failedWrites.length > 0) && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {d.toConfirm.length > 0 && (
            <div className="rounded-2xl border border-ready/30 bg-ready-soft p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ready-ink"><MessageSquareText size={16} /> {d.toConfirm.length} said yes and {d.toConfirm.length === 1 ? "is" : "are"} waiting on you</div>
              <ul className="mt-2 space-y-1.5">
                {d.toConfirm.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                    <span>
                      <span className="font-medium">{r.person.firstName} {r.person.lastName}</span>
                      <span className="text-ink-2"> for {r.campaign.case.code} · proposed {r.proposedRole === "PRIMARY" ? "primary" : "backup"}</span>
                    </span>
                    <Link href={`/outreach/${r.campaignId}`} className={buttonClass("ready")}>Review</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.failedWrites.length > 0 && (
            <div className="rounded-2xl border border-notready/30 bg-notready-soft p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-notready-ink"><TriangleAlert size={16} /> HubSpot did not accept {d.failedWrites.length} update{d.failedWrites.length === 1 ? "" : "s"}</div>
              <ul className="mt-2 space-y-1 text-sm">
                {d.failedWrites.map((c) => (
                  <li key={c.id}><CaseLink id={c.id} code={c.code} /> <span className="text-ink-2">· open the case to retry</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {canPlace ? <>{placeable}{almost}</> : <>{almost}{placeable}</>}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cases with nobody ready" hint="No ready person can reach these. Chase the people nearby." flush>
          {d.stuck.length === 0 ? (
            <div className="flex items-center gap-2 p-5 text-sm text-ink-2"><CheckCircle2 size={16} className="text-ready" /> Every open case has at least one ready match.</div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {d.stuck.slice(0, 5).map(({ case: c, days }) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                  <CaseGlyph status={c.status} size={28} />
                  <div className="min-w-0 flex-1 text-sm"><CaseLink id={c.id} code={c.code} /> <span className="text-xs text-ink-3">{c.city}, {c.state}</span></div>
                  <WaitPill days={days} />
                  <Link href={`/cases/${c.id}?show=all`} className={buttonClass("secondary")}>Who is close</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Backups about to lapse" hint="Backups release 30 days after they were attached." flush>
          {d.expiring.length === 0 ? (
            <div className="flex items-center gap-2 p-5 text-sm text-ink-2"><CheckCircle2 size={16} className="text-ready" /> No backup expires in the next 7 days.</div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {d.expiring.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <Avatar name={`${a.person.firstName} ${a.person.lastName}`} tone={personTone(a.person.kind, a.person.ready)} size={28} />
                  <div className="min-w-0 flex-1">
                    <PersonLink id={a.person.id} name={`${a.person.firstName} ${a.person.lastName}`} />
                    <span className="text-ink-3"> on </span><CaseLink id={a.case.id} code={a.case.code} />
                  </div>
                  <span className="text-xs text-ink-3">until {fmtShort(a.expiresAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
