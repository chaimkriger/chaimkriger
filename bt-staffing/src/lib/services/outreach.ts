import { prisma } from "@/lib/db";
import { classifyReply, getSalesmsgAdapter } from "@/lib/integrations/salesmsg";
import { logIntegration } from "@/lib/integrations/log";
import { normalizeMobile } from "@/lib/normalize";
import { addBackup, assignPrimary, RuleError } from "./assignments";

export function defaultOutreachBody(c: { city: string | null; state: string | null; hoursPerWeek: number }) {
  const where = [c.city, c.state].filter(Boolean).join(", ") || "your area";
  return `United Care ABA: a case is starting near you in ${where}, about ${c.hoursPerWeek} hrs/week. Interested? Reply YES or NO.`;
}

/** Text a hand-picked shortlist about one case. */
export async function sendOutreach(input: {
  caseId: string;
  personIds: string[];
  body: string;
  userId: string | null;
}) {
  const ids = [...new Set(input.personIds)];
  if (!ids.length) throw new RuleError("Pick at least one person to text.");
  if (!input.body.trim()) throw new RuleError("The message is empty.");
  const c = await prisma.case.findUniqueOrThrow({ where: { id: input.caseId } });
  if (c.status === "DISCHARGED") throw new RuleError("This case is discharged.");
  const people = await prisma.person.findMany({ where: { id: { in: ids } } });
  const sms = getSalesmsgAdapter();

  const campaign = await prisma.outreachCampaign.create({
    data: { caseId: c.id, body: input.body.trim(), createdById: input.userId },
  });
  let sent = 0;
  const failed: string[] = [];
  for (const p of people) {
    const name = `${p.firstName} ${p.lastName}`;
    if (!p.mobile) {
      failed.push(`${name} (no mobile)`);
      continue;
    }
    try {
      const { externalId } = await sms.sendText({ to: p.mobile, body: campaign.body });
      await prisma.message.create({
        data: {
          personId: p.id, direction: "out", phone: p.mobile, body: campaign.body,
          kind: "outreach", campaignId: campaign.id, externalId,
        },
      });
      await prisma.outreachRecipient.create({ data: { campaignId: campaign.id, personId: p.id } });
      sent++;
    } catch (e) {
      failed.push(`${name} (${(e as Error).message})`);
    }
  }
  await logIntegration({
    system: "salesmsg", direction: "out", action: "outreach", status: failed.length ? "error" : "ok",
    summary: `${c.code}: texted ${sent} of ${people.length}${failed.length ? `; failed: ${failed.join(", ")}` : ""} [${sms.mode}]`,
  });
  return { campaignId: campaign.id, sent, failed };
}

/**
 * Log a reply. The first YES on a campaign is PROPOSED as primary and later
 * YESes as backups. Nothing is placed here: a recruiter confirms each one.
 */
export async function recordReply(recipientId: string, text: string) {
  const r = await prisma.outreachRecipient.findUniqueOrThrow({
    where: { id: recipientId },
    include: { person: true, campaign: true },
  });
  const intent = classifyReply(text);
  const now = new Date();
  await prisma.message.create({
    data: {
      personId: r.personId, direction: "in", phone: r.person.mobile ?? "", body: text,
      kind: "outreach_reply", campaignId: r.campaignId,
    },
  });

  let proposedRole: "PRIMARY" | "BACKUP" | null = null;
  if (intent === "YES" && !r.confirmedAt) {
    const [primaryTaken, caseHasPrimary] = await Promise.all([
      prisma.outreachRecipient.findFirst({
        where: { campaignId: r.campaignId, proposedRole: "PRIMARY", id: { not: r.id } },
      }),
      prisma.assignment.findFirst({
        where: { caseId: r.campaign.caseId, role: "PRIMARY", status: "ACTIVE" },
      }),
    ]);
    proposedRole = primaryTaken || caseHasPrimary ? "BACKUP" : "PRIMARY";
  }
  await prisma.outreachRecipient.update({
    where: { id: r.id },
    data: {
      status: intent,
      replyText: text,
      repliedAt: now,
      proposedRole: r.confirmedAt ? r.proposedRole : proposedRole,
    },
  });
  return { intent, proposedRole };
}

/** Inbound webhook path: match the phone to the most recent unanswered outreach. */
export async function recordInboundText(from: string, body: string, externalId: string | null) {
  const mobile = normalizeMobile(from);
  const person = mobile ? await prisma.person.findUnique({ where: { mobile } }) : null;
  if (!person) {
    await prisma.message.create({
      data: { direction: "in", phone: mobile ?? from, body, kind: "unmatched", externalId },
    });
    return { matched: false as const };
  }
  const open = await prisma.outreachRecipient.findFirst({
    where: { personId: person.id, status: "SENT" },
    orderBy: { sentAt: "desc" },
  });
  if (open) {
    const out = await recordReply(open.id, body);
    return { matched: true as const, recipientId: open.id, ...out };
  }
  await prisma.message.create({
    data: { personId: person.id, direction: "in", phone: person.mobile ?? from, body, kind: "general", externalId },
  });
  return { matched: true as const };
}

/** Recruiter confirms a YES: this is the moment the placement is actually made. */
export async function confirmRecipient(recipientId: string, role: "PRIMARY" | "BACKUP", userId: string) {
  const r = await prisma.outreachRecipient.findUniqueOrThrow({
    where: { id: recipientId },
    include: { campaign: true },
  });
  if (r.status !== "YES") throw new RuleError("Only a YES reply can be confirmed.");
  if (r.confirmedAt) throw new RuleError("Already confirmed.");
  const args = { caseId: r.campaign.caseId, personId: r.personId, userId, via: "outreach" };
  if (role === "PRIMARY") await assignPrimary(args);
  else await addBackup(args);
  await prisma.outreachRecipient.update({
    where: { id: r.id },
    data: { confirmedAt: new Date(), proposedRole: role },
  });
}
