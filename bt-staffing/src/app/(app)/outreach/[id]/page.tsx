import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { MAX_BACKUPS } from "@/lib/constants";
import { formatMobile } from "@/lib/normalize";
import { confirmRecipientAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Card, CaseLink, CaseStatusBadge, fmtDate, PageHeader, PersonLink, ReadyBadge } from "@/components/ui";
import { SimulateReply } from "./SimulateReply";

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

  return (
    <>
      <PageHeader title={`Outreach for ${k.case.code}`} subtitle={`Sent ${fmtDate(k.createdAt)}${k.createdBy ? ` by ${k.createdBy.name}` : ""} to ${k.recipients.length} people.`}>
        <CaseStatusBadge status={k.case.status} />
        <CaseLink id={k.case.id} code="Open case" />
      </PageHeader>
      <Card title="Message">
        <p className="max-w-2xl rounded-lg bg-brand-50 px-3 py-2 text-sm">{k.body}</p>
        <p className="mt-2 text-xs text-slate-500">
          Salesmsg mode: <strong>{config.salesmsgMode}</strong>.{" "}
          {config.salesmsgMode === "mock" ? "No real texts are sent. Use the reply boxes below to simulate what people text back." : ""} The first yes is proposed as primary and later ones as backups. Nothing is placed until you confirm.
        </p>
      </Card>
      <div className="mt-4 space-y-3">
        {k.recipients.map((r) => {
          const name = `${r.person.firstName} ${r.person.lastName}`;
          return (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <PersonLink id={r.person.id} name={name} /> <ReadyBadge ready={r.person.ready} />
                  <div className="text-xs text-slate-500">{formatMobile(r.person.mobile)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "SENT" && <Badge>Waiting for reply</Badge>}
                  {r.status === "YES" && <Badge tone="green">Yes</Badge>}
                  {r.status === "NO" && <Badge tone="red">No</Badge>}
                  {r.status === "OTHER" && <Badge tone="amber">Replied (unclear)</Badge>}
                  {r.status === "YES" && !r.confirmedAt && r.proposedRole && (
                    <Badge tone="amber">Proposed {r.proposedRole === "PRIMARY" ? "primary (first yes)" : "backup"}</Badge>
                  )}
                  {r.confirmedAt && <Badge tone="blue">Confirmed as {r.proposedRole === "PRIMARY" ? "primary" : "backup"}</Badge>}
                </div>
              </div>
              {r.replyText && (
                <p className="mt-2 mr-10 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm">
                  <span className="block text-[11px] text-slate-500">Reply · {fmtDate(r.repliedAt)}</span>
                  {r.replyText}
                </p>
              )}
              {r.status === "YES" && !r.confirmedAt && canPlace && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    variant={r.proposedRole === "PRIMARY" ? "primary" : "secondary"}
                    disabled={hasPrimary}
                    title={hasPrimary ? "Case already has a primary" : undefined}
                    confirm={`Place ${name} as primary on ${k.case.code}?`}
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
            </div>
          );
        })}
      </div>
    </>
  );
}
