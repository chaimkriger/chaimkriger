import { missingChecklistItems } from "./readiness";

/** The single most useful thing to do next for an applicant. Pure. */
export type NextStepKey = "form" | "screened" | "applicationSent" | "inServicesSent" | "paperwork" | "workday" | "profile" | "place";

export interface NextStep {
  key: NextStepKey;
  /** Button / headline text */
  label: string;
  /** Who has the ball */
  owner: "applicant" | "recruiter" | "workday";
  /** True when one click on a button completes it. */
  oneClick: boolean;
  detail?: string;
}

export interface NextStepInput {
  formCompletedAt: Date | null;
  screenedAt: Date | null;
  applicationSentAt: Date | null;
  inServicesSentAt: Date | null;
  hiredAt: Date | null;
  checklist: unknown;
  availability: string[];
  lat: number | null;
}

export function nextStep(p: NextStepInput, requireWorkdayHire = true): NextStep {
  if (!p.formCompletedAt) {
    return { key: "form", label: "Text the form link", owner: "applicant", oneClick: true, detail: "Waiting on the applicant to fill in the form" };
  }
  if (!p.screenedAt) return { key: "screened", label: "Mark screened", owner: "recruiter", oneClick: true, detail: "Phone screen" };
  if (!p.applicationSentAt) return { key: "applicationSent", label: "Mark application sent", owner: "recruiter", oneClick: true };
  if (!p.inServicesSentAt) return { key: "inServicesSent", label: "Mark in-services sent", owner: "recruiter", oneClick: true };
  const paperwork = missingChecklistItems(p.checklist);
  if (paperwork.length) {
    return {
      key: "paperwork", label: `Paperwork: ${paperwork.length} left`,
      owner: "recruiter", oneClick: false, detail: paperwork.join(", "),
    };
  }
  if (!p.availability.length || p.lat == null) {
    return { key: "profile", label: "Fix availability or address", owner: "recruiter", oneClick: false };
  }
  if (requireWorkdayHire && !p.hiredAt) {
    return { key: "workday", label: "Waiting on Workday hire", owner: "workday", oneClick: false, detail: "Nothing to do here until Workday confirms the hire" };
  }
  return { key: "place", label: "Find a case", owner: "recruiter", oneClick: false };
}
