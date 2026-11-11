import { describe, expect, it } from "vitest";
import {
  type MatchCandidate, type MatchCase, compareMatches, rankCandidates, scoreCandidate,
} from "@/lib/matching";
import { openSlots } from "@/lib/availability";
import { straightLineMinutes } from "@/lib/geo/drivetime";
import { haversineMiles } from "@/lib/geo/distance";

const theCase: MatchCase = {
  id: "case1", lat: 40.65, lng: -73.95,
  slots: ["MON_PM", "TUE_PM", "WED_PM", "THU_PM"],
  languageRequired: null, ageGroup: null, rbtRequired: false,
};

function cand(over: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: "p1", name: "Test Person", kind: "APPLICANT", ready: true,
    lat: 40.66, lng: -73.94, maxTravelMinutes: 45, hasCar: true,
    openSlots: ["MON_PM", "TUE_PM", "WED_PM", "THU_PM"],
    certification: "NOT_CERTIFIED", languages: ["English"], ageGroups: [],
    ...over,
  };
}

describe("hard rules", () => {
  it("excludes a candidate whose drive is over their own max travel time", () => {
    expect(scoreCandidate(cand({ maxTravelMinutes: 30 }), theCase, 31).excluded).toBe("over_max_travel");
    expect(scoreCandidate(cand({ maxTravelMinutes: 30 }), theCase, 30).result).toBeDefined();
  });

  it("uses each person's own cap, not a global one", () => {
    const { ranked, excluded } = rankCandidates(
      theCase,
      [cand({ id: "short", maxTravelMinutes: 15 }), cand({ id: "long", maxTravelMinutes: 60 })],
      { short: 40, long: 40 },
    );
    expect(ranked.map((r) => r.candidate.id)).toEqual(["long"]);
    expect(excluded.over_max_travel).toBe(1);
  });

  it("excludes a candidate with no overlapping hours", () => {
    expect(scoreCandidate(cand({ openSlots: ["SAT_AM"] }), theCase, 10).excluded).toBe("no_overlap");
  });

  it("excludes a candidate or case with no location", () => {
    expect(scoreCandidate(cand({ lat: null }), theCase, 10).excluded).toBe("no_location");
    expect(scoreCandidate(cand(), { ...theCase, lat: null }, 10).excluded).toBe("no_location");
    expect(scoreCandidate(cand(), theCase, null).excluded).toBe("no_location");
  });
});

describe("score breakdown", () => {
  it("gives full marks to a perfect match and shows each part", () => {
    const b = scoreCandidate(cand(), theCase, 0).result!.breakdown;
    expect(b.driveScore).toBe(40);
    expect(b.availabilityScore).toBe(40);
    expect(b.requirementsScore).toBe(20);
    expect(b.total).toBe(100);
  });

  it("drive score falls as the drive gets longer", () => {
    const near = scoreCandidate(cand({ maxTravelMinutes: 90 }), theCase, 15).result!.breakdown;
    const far = scoreCandidate(cand({ maxTravelMinutes: 90 }), theCase, 45).result!.breakdown;
    const veryFar = scoreCandidate(cand({ maxTravelMinutes: 90 }), theCase, 75).result!.breakdown;
    expect(near.driveScore).toBe(30);
    expect(far.driveScore).toBe(10);
    expect(veryFar.driveScore).toBe(0);
  });

  it("availability score is the share of case hours covered", () => {
    const b = scoreCandidate(cand({ openSlots: ["MON_PM", "TUE_PM", "SUN_AM"] }), theCase, 0).result!.breakdown;
    expect(b.overlapSlots).toEqual(["MON_PM", "TUE_PM"]);
    expect(b.availabilityScore).toBe(20);
  });

  it("requirements score reflects language, RBT and age group", () => {
    const strict: MatchCase = { ...theCase, languageRequired: "Spanish", rbtRequired: true, ageGroup: "TEEN" };
    const all = scoreCandidate(
      cand({ languages: ["English", "Spanish"], certification: "CERTIFIED", ageGroups: ["TEEN"] }), strict, 0,
    ).result!.breakdown;
    expect(all.requirementsScore).toBe(20);
    expect(all.requirements.every((r) => r.credit === 1)).toBe(true);

    const none = scoreCandidate(cand({ ageGroups: ["ADULT"] }), strict, 0).result!.breakdown;
    expect(none.requirementsScore).toBe(0);
    expect(none.requirements.map((r) => r.label)).toEqual([
      "RBT required", "Speaks Spanish", "Age group experience",
    ]);

    // RBT in progress does not satisfy "RBT required"; unknown age experience is half credit.
    const partial = scoreCandidate(
      cand({ languages: ["spanish"], certification: "IN_PROGRESS" }), strict, 0,
    ).result!.breakdown;
    expect(partial.requirements.map((r) => r.credit)).toEqual([0, 1, 0.5]);
    expect(partial.requirementsScore).toBe(10);
  });
});

describe("ranking", () => {
  it("orders by total score", () => {
    const { ranked } = rankCandidates(
      theCase,
      [cand({ id: "far" }), cand({ id: "near" }), cand({ id: "half", openSlots: ["MON_PM", "TUE_PM"] })],
      { far: 30, near: 6, half: 6 },
    );
    expect(ranked.map((r) => r.candidate.id)).toEqual(["near", "far", "half"]);
  });

  it("at equal score, current staff with open hours rank ahead of new hires", () => {
    const { ranked } = rankCandidates(
      theCase,
      [
        cand({ id: "newHire", name: "Aaron Aardvark", kind: "APPLICANT" }),
        cand({ id: "staff", name: "Zed Zulu", kind: "STAFF" }),
      ],
      { newHire: 12, staff: 12 },
    );
    expect(ranked[0].breakdown.total).toBe(ranked[1].breakdown.total);
    expect(ranked.map((r) => r.candidate.id)).toEqual(["staff", "newHire"]);
  });

  it("a better-scoring new hire still beats staff", () => {
    const { ranked } = rankCandidates(
      theCase,
      [cand({ id: "staff", kind: "STAFF" }), cand({ id: "newHire" })],
      { staff: 40, newHire: 5 },
    );
    expect(ranked.map((r) => r.candidate.id)).toEqual(["newHire", "staff"]);
  });

  it("breaks remaining ties on the shorter drive", () => {
    const a = scoreCandidate(cand({ id: "a" }), theCase, 10.2).result!;
    const b = scoreCandidate(cand({ id: "b" }), theCase, 10).result!;
    expect(a.breakdown.total).toBe(b.breakdown.total);
    expect([a, b].sort(compareMatches).map((r) => r.candidate.id)).toEqual(["b", "a"]);
  });
});

describe("open availability and distance helpers", () => {
  it("staff open hours are availability minus the hours of their current cases", () => {
    expect(openSlots(["MON_PM", "TUE_PM", "WED_PM"], [["MON_PM"], ["WED_PM", "FRI_AM"]])).toEqual(["TUE_PM"]);
    expect(openSlots(["MON_PM"], [])).toEqual(["MON_PM"]);
  });

  it("staff whose open hours are all used drop out of the ranking", () => {
    const open = openSlots(theCase.slots, [theCase.slots]);
    expect(scoreCandidate(cand({ kind: "STAFF", openSlots: open }), theCase, 5).excluded).toBe("no_overlap");
  });

  it("straight-line estimate: about a mile is a few minutes by car and longer without one", () => {
    const a = { lat: 40.65, lng: -73.95 };
    const b = { lat: 40.6645, lng: -73.95 }; // ~1 mile north
    expect(haversineMiles(a, b)).toBeCloseTo(1, 1);
    const car = straightLineMinutes({ ...a, hasCar: true }, b);
    const noCar = straightLineMinutes({ ...a, hasCar: false }, b);
    expect(car).toBeGreaterThanOrEqual(3);
    expect(car).toBeLessThanOrEqual(5);
    expect(noCar).toBeGreaterThan(car);
  });
});
