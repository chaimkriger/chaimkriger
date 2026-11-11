import type { Case, Person } from "@prisma/client";
import { prisma } from "@/lib/db";
import { openSlots } from "@/lib/availability";
import { getDriveTimeProvider } from "@/lib/geo/drivetime";
import { type MatchCandidate, type MatchCase, type RankOutcome, rankCandidates } from "@/lib/matching";

export interface CandidateRow {
  person: Person;
  candidate: MatchCandidate;
  /** Cases this person is currently primary on. */
  currentCases: { id: string; code: string; slots: string[] }[];
}

export function toMatchCase(c: Case): MatchCase {
  return {
    id: c.id, lat: c.lat, lng: c.lng, slots: c.slots,
    languageRequired: c.languageRequired, ageGroup: c.ageGroup, rbtRequired: c.rbtRequired,
  };
}

/**
 * Everyone who could be considered for a case: applicants who have not been
 * placed, and current staff. Staff carry only their remaining open hours.
 */
export async function loadCandidates(): Promise<CandidateRow[]> {
  const people = await prisma.person.findMany({
    include: {
      assignments: {
        where: { role: "PRIMARY", status: "ACTIVE" },
        include: { case: { select: { id: true, code: true, slots: true, status: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return people.map((p) => {
    const currentCases = p.assignments
      .filter((a) => a.case.status === "STAFFED")
      .map((a) => ({ id: a.case.id, code: a.case.code, slots: a.case.slots }));
    const open = openSlots(p.availability, currentCases.map((c) => c.slots));
    const { assignments: _a, ...person } = p;
    void _a;
    return {
      person,
      currentCases,
      candidate: {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        kind: p.kind,
        // Staff are ready when they have somewhere to be found and hours to give.
        ready: p.kind === "STAFF" ? p.ready && open.length > 0 : p.ready,
        lat: p.lat, lng: p.lng,
        maxTravelMinutes: p.maxTravelMinutes,
        hasCar: p.hasCar,
        openSlots: open,
        certification: p.certification,
        languages: p.languages,
        ageGroups: p.ageGroups,
      },
    };
  });
}

export async function loadOpenCases(): Promise<Case[]> {
  return prisma.case.findMany({
    where: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } },
    orderBy: { waitingSince: "asc" },
  });
}

export async function rankForCase(c: Case, rows: CandidateRow[]): Promise<RankOutcome> {
  const located = rows.filter((r) => r.candidate.lat != null && r.candidate.lng != null);
  const minutes = new Map<string, number>();
  if (c.lat != null && c.lng != null) {
    const result = await getDriveTimeProvider().minutesToDestination(
      located.map((r) => ({ lat: r.candidate.lat!, lng: r.candidate.lng!, hasCar: r.candidate.hasCar })),
      { lat: c.lat, lng: c.lng },
    );
    located.forEach((r, i) => minutes.set(r.candidate.id, result[i]));
  }
  return rankCandidates(toMatchCase(c), rows.map((r) => r.candidate), minutes);
}

/** Rankings for every open case at once (work queues, dashboard counts). */
export async function matchAllOpenCases() {
  const [cases, rows] = await Promise.all([loadOpenCases(), loadCandidates()]);
  const byCase = new Map<string, RankOutcome>();
  for (const c of cases) byCase.set(c.id, await rankForCase(c, rows));
  return { cases, rows, byCase };
}
