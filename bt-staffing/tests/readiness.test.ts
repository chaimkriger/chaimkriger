import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { computeReadiness, type ReadinessInput } from "@/lib/readiness";

const d = new Date("2026-01-01");
const fullChecklist = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, true]));

function person(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    kind: "APPLICANT",
    formCompletedAt: d,
    screenedAt: d,
    applicationSentAt: d,
    inServicesSentAt: d,
    hiredAt: d,
    placedAt: null,
    checklist: fullChecklist,
    availability: ["MON_PM"],
    lat: 40.6,
    lng: -73.9,
    ...over,
  };
}

describe("pipeline stage", () => {
  it("a profile created by the HubSpot sync alone sits at Applied with 'Form not completed'", () => {
    const r = computeReadiness(
      person({
        formCompletedAt: null, screenedAt: null, applicationSentAt: null, inServicesSentAt: null,
        hiredAt: null, checklist: {}, availability: [],
      }),
    );
    expect(r.stage).toBe("APPLIED");
    expect(r.ready).toBe(false);
    expect(r.missing[0]).toBe("Form not completed");
  });

  it("walks the pipeline in order, one step at a time", () => {
    const base = {
      formCompletedAt: null, screenedAt: null, applicationSentAt: null, inServicesSentAt: null,
      hiredAt: null, checklist: {},
    };
    expect(computeReadiness(person({ ...base })).stage).toBe("APPLIED");
    expect(computeReadiness(person({ ...base, formCompletedAt: d })).stage).toBe("FORM_COMPLETED");
    expect(computeReadiness(person({ ...base, formCompletedAt: d, screenedAt: d })).stage).toBe("SCREENED");
    expect(
      computeReadiness(person({ ...base, formCompletedAt: d, screenedAt: d, applicationSentAt: d })).stage,
    ).toBe("APPLICATION_SENT");
    expect(computeReadiness(person({ hiredAt: null, checklist: {} })).stage).toBe("IN_SERVICES_SENT");
    expect(computeReadiness(person({ hiredAt: null })).stage).toBe("PAPERWORK_COMPLETE");
    expect(computeReadiness(person()).stage).toBe("READY_TO_PLACE");
    expect(computeReadiness(person({ placedAt: d })).stage).toBe("PLACED");
  });

  it("does not skip ahead: a later step done early does not move the stage past a gap", () => {
    const r = computeReadiness(person({ screenedAt: null }));
    expect(r.stage).toBe("FORM_COMPLETED");
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["Not screened"]);
  });
});

describe("readiness", () => {
  it("is ready only when nothing is missing", () => {
    const r = computeReadiness(person());
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("lists every missing paperwork item by name", () => {
    const r = computeReadiness(person({ checklist: { ...fullChecklist, i9: false, background_check: false } }));
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["I-9 and ID documents", "Background check cleared"]);
    expect(r.stage).toBe("IN_SERVICES_SENT");
  });

  it("treats an empty or malformed checklist as nothing done", () => {
    for (const checklist of [null, undefined, "x", {}]) {
      const r = computeReadiness(person({ checklist }));
      expect(r.missing).toHaveLength(CHECKLIST_ITEMS.length);
    }
  });

  it("needs availability and a map location", () => {
    expect(computeReadiness(person({ availability: [] })).missing).toEqual(["No availability on file"]);
    expect(computeReadiness(person({ lat: null })).missing).toEqual(["Address not located on map"]);
    expect(computeReadiness(person({ availability: [] })).stage).toBe("PAPERWORK_COMPLETE");
  });

  it("needs the Workday hire unless that rule is switched off", () => {
    const p = person({ hiredAt: null });
    expect(computeReadiness(p).ready).toBe(false);
    expect(computeReadiness(p).missing).toEqual(["Workday hire not confirmed"]);
    expect(computeReadiness(p, { requireWorkdayHire: false }).ready).toBe(true);
    expect(computeReadiness(p, { requireWorkdayHire: false }).stage).toBe("READY_TO_PLACE");
  });

  it("current staff are ready without the applicant paperwork", () => {
    const r = computeReadiness(
      person({ kind: "STAFF", checklist: {}, screenedAt: null, formCompletedAt: null, hiredAt: null }),
    );
    expect(r.ready).toBe(true);
    expect(r.stage).toBe("PLACED");
    expect(computeReadiness(person({ kind: "STAFF", availability: [] })).ready).toBe(false);
  });
});
