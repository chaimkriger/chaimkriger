import { CHECKLIST_ITEMS, type StageKey } from "./constants";

/**
 * Pipeline + readiness rules. Pure functions, no database access.
 *
 * A person's stage is DERIVED from what has actually happened to them, walking
 * the pipeline in order and stopping at the first step that is not done:
 *
 *   Applied > Form completed > Screened > Application sent > In-services sent
 *   > Paperwork complete > Ready to place > Placed
 *
 * "Ready" means nothing is missing. The same list of missing items drives the
 * Ready / Not ready badge, the Chase queue and the map pin colour.
 */

export interface ReadinessInput {
  kind: "APPLICANT" | "STAFF";
  formCompletedAt: Date | null;
  screenedAt: Date | null;
  applicationSentAt: Date | null;
  inServicesSentAt: Date | null;
  hiredAt: Date | null;
  placedAt: Date | null;
  checklist: unknown;
  availability: string[];
  lat: number | null;
  lng: number | null;
}

export interface ReadinessOptions {
  /** Require the Workday "hired" event before Ready. Default true. */
  requireWorkdayHire?: boolean;
}

export interface Readiness {
  ready: boolean;
  missing: string[];
  stage: StageKey;
}

export function checklistDone(checklist: unknown, key: string): boolean {
  return !!checklist && typeof checklist === "object" && (checklist as Record<string, unknown>)[key] === true;
}

export function missingChecklistItems(checklist: unknown): string[] {
  return CHECKLIST_ITEMS.filter((i) => !checklistDone(checklist, i.key)).map((i) => i.label);
}

export function computeReadiness(p: ReadinessInput, opts: ReadinessOptions = {}): Readiness {
  const requireHire = opts.requireWorkdayHire ?? true;

  // Current staff have already been through onboarding. They are placeable
  // whenever they have open hours, which the caller checks separately.
  if (p.kind === "STAFF") {
    const missing: string[] = [];
    if (!p.availability.length) missing.push("No availability on file");
    if (p.lat == null || p.lng == null) missing.push("Address not located on map");
    return { ready: missing.length === 0, missing, stage: "PLACED" };
  }

  const missing: string[] = [];
  if (!p.formCompletedAt) missing.push("Form not completed");
  if (!p.screenedAt) missing.push("Not screened");
  if (!p.applicationSentAt) missing.push("Application not sent");
  if (!p.inServicesSentAt) missing.push("In-services not sent");
  const paperworkMissing = missingChecklistItems(p.checklist);
  missing.push(...paperworkMissing);
  if (!p.availability.length) missing.push("No availability on file");
  if (p.lat == null || p.lng == null) missing.push("Address not located on map");
  if (requireHire && !p.hiredAt) missing.push("Workday hire not confirmed");

  let stage: StageKey = "APPLIED";
  if (p.formCompletedAt) {
    stage = "FORM_COMPLETED";
    if (p.screenedAt) {
      stage = "SCREENED";
      if (p.applicationSentAt) {
        stage = "APPLICATION_SENT";
        if (p.inServicesSentAt) {
          stage = "IN_SERVICES_SENT";
          if (paperworkMissing.length === 0) {
            stage = "PAPERWORK_COMPLETE";
            if (missing.length === 0) {
              stage = p.placedAt ? "PLACED" : "READY_TO_PLACE";
            }
          }
        }
      }
    }
  }

  return { ready: missing.length === 0, missing, stage };
}
