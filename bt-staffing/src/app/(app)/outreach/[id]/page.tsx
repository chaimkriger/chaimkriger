import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { MAX_BACKUPS } from "@/lib/constants";
import { formatMobile } from "@/lib/normalize";
import { confirmRecipientAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { buttonClass } from "@/components/button";
import { Avatar, Badge, CaseStatusBadge, cx, fmtDate, fmtShort, PageHeader, PersonLink, personTone, Stat } from "@/components/ui";
import { placeConfirm } from "@/components/confirms";
import { SimulateReply } from "./SimulateReply";

export const metadata: Metadata = { title: "Outreach" };

export default async function OutreachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const k = await prisma.outreachCampaign.findUnique({
    where: { id },
    include: {
      case: { include: { assignments: { where: { status: "ACTIVE" } } } },
      createdBy: true,
      recipients: { include: { person: true }, orderBy: [{ repliedAt: { sort: "asc", nulls: "last" } }, { sentAt: "asc" }] },
    },
  });
  if (!k) notFound();
  const canPlace = can(user.role, "placement.make");
  const canReply = can(user.role, "outreach.send");
  const now = new Date();
  const active = k.case.assignments.filter((a) => !a.expiresAt || a.expiresAt > now);
  const hasPrimary = active.some((a) => a.role === "PRIMARY");
  const backupsFull = active.filter((a) => a.role === "BACKUP").length >= MAX_BACKUPS;
  const n = (s: string) => k.recipients.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/outreach" className="hover:text-ink">Outreach</Link>}
        title={<span className="flex flex-wrap items-center gap-3">Outreach for <span className="num">{k.case.code}</span> <CaseStatusBadge status={k.case.status} /></span>}
        subtitle={`Sent ${fmtDate(k.createdAt)}${k.createdBy ? ` by ${k.createdBy.name}` : ""} to ${k.recipients.length} people.`}
      >
        <Link href={`/cases/${k.case.id}`} className={buttonClass("secondary", "md")}>Open case</Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Message sent</div>
            <p className="rounded-2xl rounded-br-md bg-inverse px-3.5 py-2.5 text-sm leading-relaxed text-inverse-ink">{k.body}</p>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              {config.salesmsgMode === "mock" ? "Test mode: no real texts are sent. Use the reply buttons under each person to pretend they texted back. " : ""}
              The first yes is proposed as primary and later ones as backups. Nothing is placed until you confirm.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Yes" tone="ready" value={n("YES")} />
            <Stat label="No" tone="notready" value={n("NO")} />
            <Stat label="Waiting" value={n("SENT")} />
          </div>
        </div>

        <ul className="space-y-3">
          {k.recipients.map((r) => {
            const name = `${r.person.firstName} ${r.person.lastName}`;
            const awaiting = r.status === "YES" && !r.confirmedAt;
            return (
              <li key={r.id} data-recipient className={cx("rounded-2xl border bg-surface p-4 shadow-card", awaiting ? "border-ready/50" : "border-line")}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={name} tone={personTone(r.person.kind, r.person.ready)} size={38} />
                  <div className="min-w-0 flex-1">
                    <PersonLink id={r.person.id} name={name} />
                    <div className="num text-xs text-ink-3">{formatMobile(r.person.mobile)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.status === "SENT" && <Badge>Waiting for reply</Badge>}
                    {r.status === "YES" && <Badge tone="ready">Yes</Badge>}
                    {r.status === "NO" && <Badge tone="notready">No</Badge>}
                    {r.status === "OTHER" && <Badge tone="case">Replied (unclear)</Badge>}
                    {awaiting && r.proposedRole && <Badge tone={r.proposedRole === "PRIMARY" ? "staff" : "restaff"}>Proposed {r.proposedRole === "PRIMARY" ? "primary (first yes)" : "backup"}</Badge>}
                    {r.confirmedAt && <Badge tone="staff">Confirmed as {r.proposedRole === "PRIMARY" ? "primary" : "backup"}</Badge>}
                  </div>
                </div>
                {r.replyText && (
                  <div className="mt-3 flex">
                    <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-sunken px-3.5 py-2 text-sm text-ink">
                      {r.replyText}
                      <span className="mt-1 block text-[0.66rem] text-ink-3">Reply · {fmtShort(r.repliedAt)}</span>
                    </p>
                  </div>
                )}
                {awaiting && canPlace && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      variant={r.proposedRole === "PRIMARY" ? "primary" : "secondary"}
                      disabled={hasPrimary}
                      title={hasPrimary ? "Case already has a primary" : undefined}
                      confirm={placeConfirm(name, k.case.code)}
                      action={confirmRecipientAction.bind(null, r.id, "PRIMARY")}
                    >
                      Confirm as primary
                    </ActionButton>
                    <ActionButton
                      variant={r.proposedRole === "BACKUP" ? "primary" : "secondary"}
                      disabled={backupsFull}
                      title={backupsFull ? "Backups are full" : undefined}
                      action={confirmRecipientAction.bind(null, r.id, "BACKUP")}
                    >
                      Confirm as backup
                    </ActionButton>
                  </div>
                )}
                {!r.confirmedAt && canReply && config.salesmsgMode === "mock" && <SimulateReply recipientId={r.id} hasReply={!!r.replyText} />}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
