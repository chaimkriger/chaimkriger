import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { nextStep, type NextStepInput } from "@/lib/nextStep";

const d = new Date("2026-01-01");
const full = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, true]));
const person = (over: Partial<NextStepInput> = {}): NextStepInput => ({
  formCompletedAt: d, screenedAt: d, applicationSentAt: d, inServicesSentAt: d, hiredAt: d,
  checklist: full, availability: ["MON_PM"], lat: 40.6, ...over,
});

describe("next step for an applicant", () => {
  it("follows the pipeline order and stops at the first gap", () => {
    expect(nextStep(person({ formCompletedAt: null, screenedAt: null })).key).toBe("form");
    expect(nextStep(person({ screenedAt: null, applicationSentAt: null })).key).toBe("screened");
    expect(nextStep(person({ applicationSentAt: null })).key).toBe("applicationSent");
    expect(nextStep(person({ inServicesSentAt: null })).key).toBe("inServicesSent");
  });

  it("recruiter steps are one click; paperwork and Workday are not", () => {
    expect(nextStep(person({ screenedAt: null })).oneClick).toBe(true);
    const paperwork = nextStep(person({ checklist: { ...full, i9: false, w4: false } }));
    expect(paperwork).toMatchObject({ key: "paperwork", oneClick: false, label: "Paperwork: 2 left" });
    expect(paperwork.detail).toBe("I-9 and ID documents, W-4");
    expect(nextStep(person({ hiredAt: null }))).toMatchObject({ key: "workday", owner: "workday", oneClick: false });
  });

  it("skips the Workday wait when that rule is off, and ends at finding a case", () => {
    expect(nextStep(person({ hiredAt: null }), false).key).toBe("place");
    expect(nextStep(person()).key).toBe("place");
    expect(nextStep(person({ availability: [] })).key).toBe("profile");
  });
});
