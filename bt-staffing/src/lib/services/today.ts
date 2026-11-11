import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { haversineMiles } from "@/lib/geo/distance";
import { nextStep } from "@/lib/nextStep";
import { readinessOf } from "./people";
import { matchAllOpenCases } from "./matchingService";

const DAY = 86400_000;

/** Everything the Today screen needs: the handful of things worth doing right now. */
export async function todayData() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [{ cases, byCase }, toConfirm, notReady, expiring, failedWrites, placementsThisMonth, readyApplicants, formWaiting] = await Promise.all([
    matchAllOpenCases(),
    prisma.outreachRecipient.findMany({
      where: { status: "YES", confirmedAt: null, campaign: { case: { status: { not: "DISCHARGED" } } } },
      include: { person: true, campaign: { include: { case: true } } },
      orderBy: { repliedAt: "asc" },
      take: 6,
    }),
    prisma.person.findMany({ where: { kind: "APPLICANT", ready: false } }),
    prisma.assignment.findMany({
      where: { role: "BACKUP", status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) }, case: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } } },
      include: { person: true, case: true },
      orderBy: { expiresAt: "asc" },
      take: 5,
    }),
    prisma.case.findMany({ where: { hubspotSyncStatus: "error" }, take: 5 }),
    prisma.assignment.count({ where: { role: "PRIMARY", createdAt: { gte: monthStart } } }),
    prisma.person.count({ where: { kind: "APPLICANT", ready: true } }),
    prisma.person.count({ where: { kind: "APPLICANT", formCompletedAt: null, appliedAt: { lte: new Date(now.getTime() - 3 * DAY) } } }),
  ]);

  const openCases = cases.map((c) => {
    const ranked = byCase.get(c.id)!.ranked;
    const ready = ranked.filter((m) => m.candidate.ready);
    return {
      case: c,
      days: Math.max(0, Math.floor((now.getTime() - c.waitingSince.getTime()) / DAY)),
      readyCount: ready.length,
      top: ready.slice(0, 3).map((m) => ({ id: m.candidate.id, name: m.candidate.name, kind: m.candidate.kind, total: m.breakdown.total, driveMinutes: m.breakdown.driveMinutes })),
    };
  });
  // Longest-waiting cases that someone ready could take today.
  const placeable = openCases.filter((c) => c.readyCount > 0).sort((a, b) => b.days - a.days);
  // Cases nobody ready can take: these need people chased.
  const stuck = openCases.filter((c) => c.readyCount === 0).sort((a, b) => b.days - a.days);

  const located = cases.filter((c) => c.lat != null && c.lng != null);
  const almostReady = notReady
    .map((p) => {
      const missing = readinessOf(p).missing;
      let miles: number | null = null;
      if (p.lat != null && p.lng != null) {
        for (const c of located) {
          const d = haversineMiles({ lat: p.lat, lng: p.lng }, { lat: c.lat!, lng: c.lng! });
          if (miles == null || d < miles) miles = d;
        }
      }
      return { person: p, missing, miles, step: nextStep(p, config.requireWorkdayHire) };
    })
    .filter((r) => r.missing.length <= 2)
    // Things a recruiter can act on come before people who are only waiting on Workday.
    .sort(
      (a, b) =>
        Number(a.step.owner === "workday") - Number(b.step.owner === "workday") ||
        a.missing.length - b.missing.length ||
        (a.miles ?? 999) - (b.miles ?? 999),
    );

  const waits = openCases.map((c) => c.days);
  return {
    toConfirm,
    placeable,
    stuck,
    almostReady,
    expiring,
    failedWrites,
    formWaiting,
    stats: {
      openCases: openCases.length,
      avgWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
      over30: waits.filter((d) => d > 30).length,
      readyApplicants,
      placementsThisMonth,
      notReady: notReady.length,
    },
  };
}
