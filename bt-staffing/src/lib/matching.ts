import { intersect } from "./availability";

/**
 * Matching: pure ranking functions, no database access.
 *
 * The system only RANKS. Nothing in this file (or anywhere else) places a
 * person on a case; a recruiter does that by hand.
 *
 * Hard rules (candidate is excluded):
 *   - drive time is over the person's own max travel time
 *   - no overlap at all between the person's open hours and the case hours
 *   - person or case has no map location
 *
 * Score, 0-100:
 *   - Drive time   up to 40  (0 min = 40, 60+ min = 0)
 *   - Availability up to 40  (share of the case's hours the person can cover)
 *   - Requirements up to 20  (share of the case's requirements the person meets)
 *
 * Ties on total score: current staff with open hours rank ahead of new hires,
 * then the shorter drive wins.
 */

export const WEIGHTS = { drive: 40, availability: 40, requirements: 20 } as const;
/** Drive time at which the drive score reaches zero. */
export const DRIVE_SCORE_ZERO_AT_MINUTES = 60;

export interface MatchCandidate {
  id: string;
  name: string;
  kind: "APPLICANT" | "STAFF";
  ready: boolean;
  lat: number | null;
  lng: number | null;
  maxTravelMinutes: number;
  hasCar: boolean;
  /** Hours still open (for staff: availability minus current cases). */
  openSlots: string[];
  certification: "CERTIFIED" | "IN_PROGRESS" | "NOT_CERTIFIED";
  languages: string[];
  ageGroups: string[];
}

export interface MatchCase {
  id: string;
  lat: number | null;
  lng: number | null;
  slots: string[];
  languageRequired: string | null;
  ageGroup: string | null;
  rbtRequired: boolean;
}

export interface RequirementCheck {
  label: string;
  /** 1 = met, 0.5 = unknown / partial, 0 = not met */
  credit: number;
  detail: string;
}

export interface MatchBreakdown {
  driveMinutes: number;
  maxTravelMinutes: number;
  driveScore: number;
  overlapSlots: string[];
  caseSlotCount: number;
  availabilityScore: number;
  requirements: RequirementCheck[];
  requirementsScore: number;
  total: number;
}

export interface MatchResult {
  candidate: MatchCandidate;
  breakdown: MatchBreakdown;
}

export type ExclusionReason = "no_location" | "over_max_travel" | "no_overlap";

export interface ScoreOutcome {
  result?: MatchResult;
  excluded?: ExclusionReason;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function checkRequirements(c: MatchCandidate, k: MatchCase): RequirementCheck[] {
  const checks: RequirementCheck[] = [];
  if (k.rbtRequired) {
    if (c.certification === "CERTIFIED") {
      checks.push({ label: "RBT required", credit: 1, detail: "Certified" });
    } else if (c.certification === "IN_PROGRESS") {
      checks.push({ label: "RBT required", credit: 0, detail: "Certification still in progress" });
    } else {
      checks.push({ label: "RBT required", credit: 0, detail: "Not certified" });
    }
  }
  if (k.languageRequired) {
    const speaks = c.languages.some((l) => l.toLowerCase() === k.languageRequired!.toLowerCase());
    checks.push({
      label: `Speaks ${k.languageRequired}`,
      credit: speaks ? 1 : 0,
      detail: speaks ? "Yes" : "Not listed",
    });
  }
  if (k.ageGroup) {
    if (c.ageGroups.includes(k.ageGroup)) {
      checks.push({ label: "Age group experience", credit: 1, detail: "Has experience" });
    } else if (c.ageGroups.length === 0) {
      checks.push({ label: "Age group experience", credit: 0.5, detail: "No experience on file yet" });
    } else {
      checks.push({ label: "Age group experience", credit: 0, detail: "Experience is with other ages" });
    }
  }
  return checks;
}

export function scoreCandidate(c: MatchCandidate, k: MatchCase, driveMinutes: number | null): ScoreOutcome {
  if (c.lat == null || c.lng == null || k.lat == null || k.lng == null || driveMinutes == null) {
    return { excluded: "no_location" };
  }
  if (driveMinutes > c.maxTravelMinutes) return { excluded: "over_max_travel" };

  const overlap = intersect(k.slots, c.openSlots);
  if (overlap.length === 0) return { excluded: "no_overlap" };

  const driveScore = round1(
    WEIGHTS.drive * Math.max(0, 1 - driveMinutes / DRIVE_SCORE_ZERO_AT_MINUTES),
  );
  const availabilityScore = round1(WEIGHTS.availability * (overlap.length / k.slots.length));
  const requirements = checkRequirements(c, k);
  const requirementsScore = round1(
    requirements.length === 0
      ? WEIGHTS.requirements
      : WEIGHTS.requirements * (requirements.reduce((s, r) => s + r.credit, 0) / requirements.length),
  );
  // Whole-number total so that near-identical candidates tie and the
  // "current staff first" rule decides.
  const total = Math.round(driveScore + availabilityScore + requirementsScore);

  return {
    result: {
      candidate: c,
      breakdown: {
        driveMinutes,
        maxTravelMinutes: c.maxTravelMinutes,
        driveScore,
        overlapSlots: overlap,
        caseSlotCount: k.slots.length,
        availabilityScore,
        requirements,
        requirementsScore,
        total,
      },
    },
  };
}

export function compareMatches(a: MatchResult, b: MatchResult): number {
  if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total;
  if (a.candidate.kind !== b.candidate.kind) return a.candidate.kind === "STAFF" ? -1 : 1;
  if (a.breakdown.driveMinutes !== b.breakdown.driveMinutes) {
    return a.breakdown.driveMinutes - b.breakdown.driveMinutes;
  }
  return a.candidate.name.localeCompare(b.candidate.name);
}

export interface RankOutcome {
  ranked: MatchResult[];
  excluded: Record<ExclusionReason, number>;
}

/**
 * Rank candidates for one case.
 * @param driveMinutes travel minutes per candidate id (missing = unknown)
 */
export function rankCandidates(
  k: MatchCase,
  candidates: MatchCandidate[],
  driveMinutes: Map<string, number> | Record<string, number>,
): RankOutcome {
  const get = (id: string): number | null => {
    const v = driveMinutes instanceof Map ? driveMinutes.get(id) : driveMinutes[id];
    return v == null ? null : v;
  };
  const ranked: MatchResult[] = [];
  const excluded: Record<ExclusionReason, number> = { no_location: 0, over_max_travel: 0, no_overlap: 0 };
  for (const c of candidates) {
    const out = scoreCandidate(c, k, get(c.id));
    if (out.result) ranked.push(out.result);
    else if (out.excluded) excluded[out.excluded]++;
  }
  ranked.sort(compareMatches);
  return { ranked, excluded };
}

// ---------------------------------------------------------------------------
// Plain-language summaries of a match, for people who should not have to
// read a score breakdown.
// ---------------------------------------------------------------------------

/** One or two words for the total score. */
export function matchLabel(total: number): "Great match" | "Good match" | "Fair match" | "Weak match" {
  if (total >= 80) return "Great match";
  if (total >= 60) return "Good match";
  if (total >= 40) return "Fair match";
  return "Weak match";
}

const shortRequirement = (label: string) =>
  label === "RBT required" ? "RBT certification" : label.startsWith("Speaks ") ? label.slice(7) : "experience with this age group";

/** "Meets every requirement" / "Missing: Spanish" / "To check: ..." */
export function fitSummary(requirements: RequirementCheck[]): { text: string; ok: boolean } {
  if (requirements.length === 0) return { text: "No special requirements", ok: true };
  const missing = requirements.filter((r) => r.credit === 0).map((r) => shortRequirement(r.label));
  const unsure = requirements.filter((r) => r.credit > 0 && r.credit < 1).map((r) => shortRequirement(r.label));
  if (!missing.length && !unsure.length) return { text: "Meets every requirement", ok: true };
  const parts: string[] = [];
  if (missing.length) parts.push(`Missing: ${missing.join(", ")}`);
  if (unsure.length) parts.push(`To check: ${unsure.join(", ")}`);
  return { text: parts.join(". "), ok: false };
}

/** The whole match in one sentence. */
export function matchSentence(b: Pick<MatchBreakdown, "driveMinutes" | "overlapSlots" | "caseSlotCount">): string {
  const all = b.overlapSlots.length === b.caseSlotCount;
  return `${b.driveMinutes} min away · can cover ${all ? "all" : `${b.overlapSlots.length} of`} ${b.caseSlotCount} time slot${b.caseSlotCount === 1 ? "" : "s"}`;
}
