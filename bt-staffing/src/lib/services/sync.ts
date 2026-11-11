import { prisma } from "@/lib/db";
import { getHubSpotAdapter } from "@/lib/integrations/hubspot";
import { logIntegration } from "@/lib/integrations/log";
import { getIntakeSource } from "@/lib/intake/sources";
import { ingestApplicant } from "@/lib/intake/pipeline";
import { cleanSlots } from "@/lib/availability";
import { locate } from "./people";
import { setCaseStatus, sweepExpiredBackups } from "./assignments";

export interface SyncResult {
  applicantsCreated: number;
  applicantsUpdated: number;
  applicantErrors: number;
  casesCreated: number;
  casesUpdated: number;
  backupsExpired: number;
}

/** Pull new applicants from the intake source. */
export async function syncApplicants() {
  const source = getIntakeSource();
  const applicants = await source.fetchApplicants();
  let created = 0, updated = 0, errors = 0;
  for (const a of applicants) {
    try {
      const r = await ingestApplicant(a);
      if (r.created) created++;
      else updated++;
    } catch {
      errors++;
    }
  }
  await logIntegration({
    system: "intake", direction: "in", action: "sync_applicants", status: errors ? "error" : "ok",
    summary: `${source.name}: ${applicants.length} read, ${created} new, ${updated} matched, ${errors} skipped`,
  });
  return { created, updated, errors };
}

/**
 * Read cases from HubSpot. HubSpot owns the case details and can discharge a
 * case or send it to restaffing; this app owns who is staffed on it.
 */
export async function syncCases() {
  const adapter = getHubSpotAdapter();
  const cases = await adapter.listCases();
  let created = 0, updated = 0;
  for (const h of cases) {
    const existing = await prisma.case.findUnique({ where: { hubspotId: h.id } });
    const addressChanged = !existing || existing.address !== h.address || existing.zip !== h.zip;
    const loc = addressChanged ? await locate(h.address, h.zip) : null;
    const details = {
      code: h.code,
      clientLabel: h.clientLabel,
      address: h.address,
      city: loc?.city ?? h.city,
      state: loc?.state ?? h.state,
      zip: loc?.zip ?? h.zip,
      ...(addressChanged ? { lat: loc?.lat ?? null, lng: loc?.lng ?? null } : {}),
      slots: cleanSlots(h.slots),
      hoursPerWeek: h.hoursPerWeek ?? undefined,
      languageRequired: h.languageRequired,
      ageGroup: h.ageGroup,
      rbtRequired: h.rbtRequired,
      notes: h.notes,
    };
    if (!existing) {
      const since = h.assessmentCompletedAt ?? new Date();
      // A case that HubSpot calls "staffed" but that has nobody on it here still needs a BT.
      const status = h.status === "DISCHARGED" ? "DISCHARGED" : h.status === "RESTAFFING" ? "RESTAFFING" : "NEEDS_STAFFING";
      await prisma.case.create({
        data: {
          ...details, hubspotId: h.id, status,
          assessmentCompletedAt: since, waitingSince: since,
          dischargedAt: status === "DISCHARGED" ? new Date() : null,
        },
      });
      created++;
    } else {
      await prisma.case.update({ where: { id: existing.id }, data: details });
      if (h.status === "DISCHARGED" && existing.status !== "DISCHARGED") {
        await setCaseStatus(existing.id, "DISCHARGED");
      } else if (h.status === "RESTAFFING" && existing.status === "STAFFED") {
        await setCaseStatus(existing.id, "RESTAFFING");
      }
      updated++;
    }
  }
  await logIntegration({
    system: "hubspot", direction: "in", action: "sync_cases", status: "ok",
    summary: `${cases.length} cases read, ${created} new, ${updated} updated [${adapter.mode}]`,
  });
  return { created, updated };
}

export async function runFullSync(): Promise<SyncResult> {
  try {
    const a = await syncApplicants();
    const c = await syncCases();
    const backupsExpired = await sweepExpiredBackups();
    return {
      applicantsCreated: a.created, applicantsUpdated: a.updated, applicantErrors: a.errors,
      casesCreated: c.created, casesUpdated: c.updated, backupsExpired,
    };
  } catch (e) {
    await logIntegration({
      system: "hubspot", direction: "in", action: "sync", status: "error",
      summary: (e as Error).message,
    });
    throw e;
  }
}
