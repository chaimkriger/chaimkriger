import { prisma } from "@/lib/db";
import { BACKUP_DAYS, MAX_BACKUPS } from "@/lib/constants";
import { readinessOf, refreshPerson } from "./people";
import { syncCaseToHubSpot } from "./writeback";

/** Thrown for rule violations; the message is safe to show to the recruiter. */
export class RuleError extends Error {}

const activeNow = () => {
  const now = new Date();
  return { status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
};

async function syncAll(caseIds: Iterable<string>) {
  for (const id of new Set(caseIds)) await syncCaseToHubSpot(id);
}

/**
 * Place a person as the primary BT on a case. Always called from a recruiter
 * action; nothing in the system calls this on its own.
 */
export async function assignPrimary(input: {
  caseId: string;
  personId: string;
  userId: string | null;
  via?: string;
}) {
  const touched = new Set<string>([input.caseId]);
  await prisma.$transaction(async (tx) => {
    const c = await tx.case.findUniqueOrThrow({ where: { id: input.caseId } });
    if (c.status === "DISCHARGED") throw new RuleError("This case is discharged.");
    const existingPrimary = await tx.assignment.findFirst({
      where: { caseId: c.id, role: "PRIMARY", status: "ACTIVE" },
    });
    if (existingPrimary) {
      throw new RuleError("This case already has a primary BT. Move it to restaffing first.");
    }
    const p = await tx.person.findUniqueOrThrow({ where: { id: input.personId } });
    const r = readinessOf(p);
    if (!r.ready) throw new RuleError(`${p.firstName} ${p.lastName} is not ready: ${r.missing.join(", ")}.`);

    const now = new Date();
    // A backup on this same case who becomes primary stops being a backup.
    await tx.assignment.updateMany({
      where: { caseId: c.id, personId: p.id, role: "BACKUP", status: "ACTIVE" },
      data: { status: "ENDED", endedAt: now, endReason: "promoted_to_primary" },
    });
    // "Backups stay attached for 30 days unless placed elsewhere."
    const elsewhere = await tx.assignment.findMany({
      where: { personId: p.id, role: "BACKUP", status: "ACTIVE", caseId: { not: c.id } },
    });
    for (const a of elsewhere) touched.add(a.caseId);
    await tx.assignment.updateMany({
      where: { id: { in: elsewhere.map((a) => a.id) } },
      data: { status: "ENDED", endedAt: now, endReason: "placed_elsewhere" },
    });

    await tx.assignment.create({
      data: {
        caseId: c.id, personId: p.id, role: "PRIMARY",
        createdById: input.userId, via: input.via ?? "manual",
      },
    });
    await tx.case.update({ where: { id: c.id }, data: { status: "STAFFED", staffedAt: now } });
    await tx.person.update({
      where: { id: p.id },
      data: { kind: "STAFF", placedAt: p.placedAt ?? now, hiredAt: p.hiredAt ?? now },
    });
    await refreshPerson(p.id, tx);
  });
  await syncAll(touched);
}

export async function addBackup(input: {
  caseId: string;
  personId: string;
  userId: string | null;
  via?: string;
}) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.case.findUniqueOrThrow({ where: { id: input.caseId } });
    if (c.status === "DISCHARGED") throw new RuleError("This case is discharged.");
    const active = await tx.assignment.findMany({ where: { caseId: c.id, ...activeNow() } });
    if (active.some((a) => a.personId === input.personId)) {
      throw new RuleError("This person is already attached to the case.");
    }
    if (active.filter((a) => a.role === "BACKUP").length >= MAX_BACKUPS) {
      throw new RuleError(`A case can have at most ${MAX_BACKUPS} backups.`);
    }
    await tx.assignment.create({
      data: {
        caseId: c.id, personId: input.personId, role: "BACKUP",
        expiresAt: new Date(Date.now() + BACKUP_DAYS * 86400_000),
        createdById: input.userId, via: input.via ?? "manual",
      },
    });
  });
  await syncAll([input.caseId]);
}

/** Remove a primary or backup. Removing the primary sends the case to restaffing. */
export async function endAssignment(assignmentId: string, reason = "removed") {
  const a = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  if (a.status !== "ACTIVE") return;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id: a.id },
      data: { status: "ENDED", endedAt: now, endReason: reason },
    });
    if (a.role === "PRIMARY") {
      await tx.case.updateMany({
        where: { id: a.caseId, status: "STAFFED" },
        data: { status: "RESTAFFING", waitingSince: now, staffedAt: null },
      });
    }
  });
  await syncAll([a.caseId]);
}

export async function setCaseStatus(caseId: string, status: "RESTAFFING" | "DISCHARGED" | "NEEDS_STAFFING") {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const c = await tx.case.findUniqueOrThrow({ where: { id: caseId } });
    if (status === "RESTAFFING") {
      if (c.status !== "STAFFED") throw new RuleError("Only a staffed case can move to restaffing.");
      // The primary comes off; backups stay so they can be offered the case first.
      await tx.assignment.updateMany({
        where: { caseId, role: "PRIMARY", status: "ACTIVE" },
        data: { status: "ENDED", endedAt: now, endReason: "restaffing" },
      });
      await tx.case.update({
        where: { id: caseId },
        data: { status: "RESTAFFING", waitingSince: now, staffedAt: null },
      });
    } else if (status === "DISCHARGED") {
      await tx.assignment.updateMany({
        where: { caseId, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: now, endReason: "discharged" },
      });
      await tx.case.update({ where: { id: caseId }, data: { status: "DISCHARGED", dischargedAt: now } });
    } else {
      if (c.status !== "DISCHARGED") throw new RuleError("Only a discharged case can be reopened.");
      await tx.case.update({
        where: { id: caseId },
        data: { status: "NEEDS_STAFFING", waitingSince: now, dischargedAt: null, staffedAt: null },
      });
    }
  });
  await syncAll([caseId]);
}

/** Expire backups older than 30 days and tell HubSpot about the cases affected. */
export async function sweepExpiredBackups(): Promise<number> {
  const now = new Date();
  const expired = await prisma.assignment.findMany({
    where: { role: "BACKUP", status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true, caseId: true },
  });
  if (!expired.length) return 0;
  await prisma.assignment.updateMany({
    where: { id: { in: expired.map((e) => e.id) } },
    data: { status: "EXPIRED", endedAt: now, endReason: "30_days_elapsed" },
  });
  await syncAll(expired.map((e) => e.caseId));
  return expired.length;
}
