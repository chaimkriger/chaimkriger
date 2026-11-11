import { haversineMiles } from "@/lib/geo/distance";
import type { MatchBreakdown } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { readinessOf } from "./people";
import { type CandidateRow, loadCandidates, loadOpenCases, matchAllOpenCases, rankForCase } from "./matchingService";

export interface CaseMatch {
  caseId: string;
  code: string;
  city: string | null;
  state: string | null;
  status: string;
  breakdown: MatchBreakdown;
}

/** Chase: not-ready applicants, nearest open case first, with what is missing. */
export async function chaseQueue() {
  const [people, cases] = await Promise.all([
    prisma.person.findMany({ where: { kind: "APPLICANT", ready: false }, include: { recruiter: true } }),
    loadOpenCases(),
  ]);
  const located = cases.filter((c) => c.lat != null && c.lng != null);
  const rows = people.map((p) => {
    let nearest: { id: string; code: string; miles: number } | null = null;
    if (p.lat != null && p.lng != null) {
      for (const c of located) {
        const miles = haversineMiles({ lat: p.lat, lng: p.lng }, { lat: c.lat!, lng: c.lng! });
        if (!nearest || miles < nearest.miles) nearest = { id: c.id, code: c.code, miles };
      }
    }
    return { person: p, missing: readinessOf(p).missing, nearest };
  });
  rows.sort((a, b) => (a.nearest?.miles ?? Infinity) - (b.nearest?.miles ?? Infinity));
  return rows;
}

/** Place: ready people (new hires and staff with open hours) with their best open cases. */
export async function placeQueue() {
  const { cases, rows, byCase } = await matchAllOpenCases();
  const perPerson = new Map<string, CaseMatch[]>();
  for (const c of cases) {
    for (const m of byCase.get(c.id)!.ranked) {
      if (!m.candidate.ready) continue;
      const list = perPerson.get(m.candidate.id) ?? [];
      list.push({ caseId: c.id, code: c.code, city: c.city, state: c.state, status: c.status, breakdown: m.breakdown });
      perPerson.set(m.candidate.id, list);
    }
  }
  const ready = rows.filter((r) => r.candidate.ready);
  const out = ready.map((r) => ({
    row: r,
    matches: (perPerson.get(r.candidate.id) ?? []).sort((a, b) => b.breakdown.total - a.breakdown.total),
  }));
  out.sort((a, b) => (b.matches[0]?.breakdown.total ?? -1) - (a.matches[0]?.breakdown.total ?? -1));
  return out;
}

/** Open cases: days waiting and how many ready people match. */
export async function openCasesQueue() {
  const { cases, byCase } = await matchAllOpenCases();
  const now = new Date();
  const backups = await prisma.assignment.groupBy({
    by: ["caseId"],
    where: { role: "BACKUP", status: "ACTIVE", expiresAt: { gt: now }, caseId: { in: cases.map((c) => c.id) } },
    _count: true,
  });
  const backupCount = new Map(backups.map((b) => [b.caseId, b._count]));
  return cases.map((c) => {
    const ranked = byCase.get(c.id)!.ranked;
    const readyMatches = ranked.filter((m) => m.candidate.ready);
    return {
      case: c,
      readyMatches: readyMatches.length,
      allMatches: ranked.length,
      best: readyMatches[0] ?? null,
      backups: backupCount.get(c.id) ?? 0,
    };
  });
}

/** Best open cases for one person (profile screen). */
export async function topCasesForPerson(personId: string, limit = 5): Promise<{ row: CandidateRow | null; matches: CaseMatch[] }> {
  const [rows, cases] = await Promise.all([loadCandidates(), loadOpenCases()]);
  const row = rows.find((r) => r.person.id === personId) ?? null;
  if (!row) return { row: null, matches: [] };
  const matches: CaseMatch[] = [];
  for (const c of cases) {
    const { ranked } = await rankForCase(c, [row]);
    if (ranked[0]) {
      matches.push({ caseId: c.id, code: c.code, city: c.city, state: c.state, status: c.status, breakdown: ranked[0].breakdown });
    }
  }
  matches.sort((a, b) => b.breakdown.total - a.breakdown.total);
  return { row, matches: matches.slice(0, limit) };
}
