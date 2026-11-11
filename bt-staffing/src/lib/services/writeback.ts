import { prisma } from "@/lib/db";
import { getHubSpotAdapter, type HubSpotAdapter, type StaffingWriteBack } from "@/lib/integrations/hubspot";
import { logIntegration } from "@/lib/integrations/log";

/** Build the write-back payload for a case from its current active assignments. */
export async function buildStaffingWriteBack(caseId: string): Promise<{
  hubspotId: string | null;
  code: string;
  staffing: StaffingWriteBack;
}> {
  const now = new Date();
  const c = await prisma.case.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      assignments: {
        where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: { person: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const toPerson = (a: (typeof c.assignments)[number]) => ({
    name: `${a.person.firstName} ${a.person.lastName}`.trim(),
    mobile: a.person.mobile,
    email: a.person.email,
  });
  const primary = c.assignments.find((a) => a.role === "PRIMARY");
  return {
    hubspotId: c.hubspotId,
    code: c.code,
    staffing: {
      status: c.status,
      primary: primary ? toPerson(primary) : null,
      backups: c.assignments.filter((a) => a.role === "BACKUP").map(toPerson),
      staffedAt: c.status === "STAFFED" ? c.staffedAt : null,
    },
  };
}

/**
 * Write the case's primary and backups to HubSpot. Never throws: a HubSpot
 * failure must not undo a placement. The result is stored on the case and in
 * the integration log, and can be retried from the case screen.
 */
export async function syncCaseToHubSpot(
  caseId: string,
  adapter: HubSpotAdapter = getHubSpotAdapter(),
): Promise<{ ok: boolean; error?: string }> {
  const { hubspotId, code, staffing } = await buildStaffingWriteBack(caseId);
  if (!hubspotId) {
    await prisma.case.update({
      where: { id: caseId },
      data: { hubspotSyncStatus: "skipped", hubspotSyncError: "Case has no HubSpot id" },
    });
    await logIntegration({
      system: "hubspot", direction: "out", action: "write_staffing", status: "skipped",
      summary: `${code}: no HubSpot id, nothing written`,
    });
    return { ok: false, error: "Case has no HubSpot id" };
  }
  try {
    await adapter.writeStaffing(hubspotId, staffing);
    await prisma.case.update({
      where: { id: caseId },
      data: { hubspotSyncStatus: "ok", hubspotSyncedAt: new Date(), hubspotSyncError: null },
    });
    await logIntegration({
      system: "hubspot", direction: "out", action: "write_staffing", status: "ok",
      summary: `${code}: primary ${staffing.primary?.name ?? "none"}, ${staffing.backups.length} backup(s) [${adapter.mode}]`,
      payload: { hubspotId, staffing },
    });
    return { ok: true };
  } catch (e) {
    const error = (e as Error).message;
    await prisma.case.update({
      where: { id: caseId },
      data: { hubspotSyncStatus: "error", hubspotSyncError: error.slice(0, 500) },
    });
    await logIntegration({
      system: "hubspot", direction: "out", action: "write_staffing", status: "error",
      summary: `${code}: ${error}`,
      payload: { hubspotId, staffing },
    });
    return { ok: false, error };
  }
}
