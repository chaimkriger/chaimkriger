/**
 * Seed: FAKE DATA ONLY. Names are random first/last combinations, phone
 * numbers use the reserved 555-01xx range, emails use example.com and street
 * addresses are invented. Deterministic: the same data every run.
 *
 *   ~150 applicants, 80 staff, 40 open cases (needs staffing / restaffing)
 *   plus 60 staffed / discharged cases so current staff have caseloads.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_SLOTS, BACKUP_DAYS, CHECKLIST_ITEMS } from "../src/lib/constants";
import { openSlots } from "../src/lib/availability";
import { computeReadiness } from "../src/lib/readiness";
import { haversineMiles } from "../src/lib/geo/distance";
import { ZIPS, type ZipInfo } from "../src/lib/geo/zipdata";
import { HUBSPOT_PROPS, HUBSPOT_STATUS_VALUES } from "../src/lib/integrations/hubspot/types";

const prisma = new PrismaClient();

// --- deterministic random ---------------------------------------------------
let seedState = 20260101;
function rnd(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
const DAY = 86400_000;
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY);

const FIRST = [
  "Avery", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Quinn", "Reese", "Skyler", "Dakota",
  "Emerson", "Finley", "Harper", "Jamie", "Kendall", "Logan", "Marley", "Noel", "Parker", "Rowan",
  "Sage", "Tatum", "Devon", "Elliot", "Frankie", "Gray", "Hollis", "Indigo", "Jules", "Kai",
  "Lane", "Micah", "Nico", "Oakley", "Peyton", "Remy", "Shiloh", "Toby", "Val", "Wren",
  "Ari", "Blake", "Cameron", "Drew", "Eden", "Flynn", "Greer", "Hayden", "Ira", "Jesse",
];
const LAST = [
  "Alder", "Birch", "Cedar", "Dunmore", "Eastman", "Fairbank", "Glenwood", "Hartwell", "Ironside", "Juniper",
  "Kestrel", "Larkin", "Maplewood", "Northcott", "Oakhurst", "Pinecrest", "Quimby", "Redfern", "Stonebridge", "Thornbury",
  "Underhill", "Vance", "Westbrook", "Yarrow", "Ashdown", "Brightwater", "Coldwell", "Driftwood", "Elmsworth", "Foxglove",
  "Greenleaf", "Hawthorne", "Ivywood", "Kingsley", "Lockwood", "Merriweather", "Nettlefield", "Orchard", "Pemberton", "Ravenscroft",
  "Silverlake", "Tidewater", "Umberfield", "Windham", "Applegate", "Bellweather", "Copperfield", "Dovecote", "Evergreen", "Fernsby",
];
const STREETS = [
  "Sample St", "Demo Ave", "Placeholder Rd", "Example Blvd", "Mockingbird Ln", "Testwood Dr",
  "Fictional Way", "Specimen Ct", "Prototype Pl", "Makebelieve Ter",
];
const AREA_CODES: Record<string, string[]> = { NY: ["718", "347"], NJ: ["201", "973"], CO: ["303", "720"] };
const AGE_GROUPS = ["EARLY", "CHILD", "TEEN", "ADULT"];

const byState = (s: string) => ZIPS.filter((z) => z.state === s);
// Keep the far-flung NJ ZIPs rare so most people have a case within reach.
function randomZip(state: string): ZipInfo {
  const pool = byState(state);
  for (;;) {
    const z = pool[Math.floor(rnd() * pool.length)];
    if (["08701", "08901", "08817"].includes(z.zip) && !chance(0.25)) continue;
    return z;
  }
}
function nearbyZip(from: ZipInfo, maxMiles: number): ZipInfo {
  const pool = byState(from.state).filter((z) => haversineMiles(z, from) <= maxMiles);
  return pool.length ? pick(pool) : from;
}
function jitter(z: ZipInfo) {
  return { lat: +(z.lat + (rnd() - 0.5) * 0.012).toFixed(5), lng: +(z.lng + (rnd() - 0.5) * 0.016).toFixed(5) };
}

const usedNames = new Set<string>();
const phoneCounters: Record<string, number> = {};
let emailN = 0;
function identity(state: string) {
  let first: string, last: string;
  do {
    first = pick(FIRST);
    last = pick(LAST);
  } while (usedNames.has(`${first} ${last}`));
  usedNames.add(`${first} ${last}`);
  // 555-0100..0199 is reserved for fiction; rotate area codes to stay unique.
  let mobile = "";
  for (const ac of [...AREA_CODES[state], "929", "551", "862", "719", "845", "908"]) {
    const n = phoneCounters[ac] ?? 0;
    if (n < 100) {
      phoneCounters[ac] = n + 1;
      mobile = `+1${ac}55501${String(n).padStart(2, "0")}`;
      break;
    }
  }
  emailN++;
  const email = `${first}.${last}${emailN}@example.com`.toLowerCase();
  return { firstName: first, lastName: last, mobile, email };
}

function languages(state: string): string[] {
  const out = ["English"];
  if (chance(0.32)) out.push("Spanish");
  if (state !== "CO" && chance(0.09)) out.push("Russian");
  if (state !== "CO" && chance(0.07)) out.push("Yiddish");
  if (state === "NY" && chance(0.05)) out.push("Haitian Creole");
  if (chance(0.04)) out.push("Mandarin");
  if (chance(0.03)) out.push("Arabic");
  return out;
}

function personAvailability(): string[] {
  const p: Record<string, number> = { AM: 0.3, PM: 0.72, EVE: 0.5 };
  const slots = ALL_SLOTS.filter((s) => {
    const [d, period] = s.split("_");
    const weekend = d === "SAT" || d === "SUN";
    return chance(weekend ? p[period] * 0.45 : p[period]);
  });
  return slots.length >= 3 ? slots : ["MON_PM", "TUE_PM", "WED_PM", "THU_PM"];
}

function caseSlots(ageGroup: string): string[] {
  const period = ageGroup === "EARLY" && chance(0.6) ? "AM" : chance(0.7) ? "PM" : "EVE";
  const days = ["MON", "TUE", "WED", "THU", "FRI"].filter(() => chance(0.65));
  while (days.length < 3) {
    const d = pick(["MON", "TUE", "WED", "THU", "FRI"]);
    if (!days.includes(d)) days.push(d);
  }
  const slots = days.map((d) => `${d}_${period}`);
  if (chance(0.15)) slots.push(`SUN_${chance(0.5) ? "AM" : "PM"}`);
  return ALL_SLOTS.filter((s) => slots.includes(s));
}

const fullChecklist = () => Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, true]));
function partialChecklist(): Record<string, boolean> {
  const c: Record<string, boolean> = {};
  for (const i of CHECKLIST_ITEMS) if (chance(0.55)) c[i.key] = true;
  // Make sure it really is partial.
  delete c[pick(CHECKLIST_ITEMS).key];
  return c;
}

async function main() {
  if (process.env.SEED_ONLY_IF_EMPTY === "true" && (await prisma.user.count()) > 0) {
    console.log("Database already has users: seed skipped.");
    return;
  }
  console.log("Clearing tables...");
  await prisma.message.deleteMany();
  await prisma.note.deleteMany();
  await prisma.outreachRecipient.deleteMany();
  await prisma.outreachCampaign.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.case.deleteMany();
  await prisma.person.deleteMany();
  await prisma.integrationLog.deleteMany();
  await prisma.mockHubspotObject.deleteMany();
  await prisma.user.deleteMany();

  // --- users ------------------------------------------------------------------
  const users = [
    { id: "user-recruiter", email: "recruiter@example.com", name: "Robin Recruiter", role: "RECRUITER" as const, password: "Recruiter123!" },
    { id: "user-recruiter2", email: "recruiter2@example.com", name: "Sam Staffer", role: "RECRUITER" as const, password: "Recruiter123!" },
    { id: "user-offshore", email: "offshore@example.com", name: "Ola Offshore", role: "OFFSHORE_RECRUITER" as const, password: "Offshore123!" },
    { id: "user-admin", email: "admin@example.com", name: "Alex Admin", role: "ADMIN" as const, password: "Admin123!" },
  ];
  await prisma.user.createMany({
    data: users.map(({ password, ...u }) => ({ ...u, passwordHash: bcrypt.hashSync(password, 10) })),
  });
  const placers = ["user-recruiter", "user-recruiter2", "user-admin"];
  const pickPlacer = () => (chance(0.5) ? placers[0] : chance(0.75) ? placers[1] : placers[2]);

  const people: Prisma.PersonCreateManyInput[] = [];
  const cases: Prisma.CaseCreateManyInput[] = [];
  const assignments: Prisma.AssignmentCreateManyInput[] = [];
  const hubspot: Prisma.MockHubspotObjectCreateManyInput[] = [];
  let hsId = 880001;
  let caseN = 1000;

  const C = HUBSPOT_PROPS.case;
  const K = HUBSPOT_PROPS.contact;

  function makeCase(
    zip: ZipInfo,
    status: "NEEDS_STAFFING" | "STAFFED" | "RESTAFFING" | "DISCHARGED",
    over: Partial<Prisma.CaseCreateManyInput> = {},
  ) {
    caseN++;
    const ageGroup = pick(["EARLY", "EARLY", "CHILD", "CHILD", "CHILD", "TEEN", "ADULT"]);
    const slots = (over.slots as string[] | undefined) ?? caseSlots(ageGroup);
    const loc = jitter(zip);
    const languageRequired = chance(0.28)
      ? zip.state === "CO" ? "Spanish" : pick(["Spanish", "Spanish", "Spanish", "Russian", "Yiddish"])
      : null;
    const waiting = int(1, 45);
    const c = {
      id: `case-${caseN}`,
      code: `UC-${zip.state}-${caseN}`,
      clientLabel: `Client ${caseN}`,
      address: `${int(10, 999)} ${pick(STREETS)}, ${zip.city}, ${zip.state} ${zip.zip}`,
      city: zip.city, state: zip.state, zip: zip.zip, lat: loc.lat, lng: loc.lng,
      slots,
      hoursPerWeek: slots.length * 3,
      languageRequired,
      ageGroup,
      rbtRequired: chance(0.25),
      notes: chance(0.4) ? pick([
        "Family prefers a consistent weekly schedule.",
        "Walk-up apartment, third floor.",
        "Sessions take place at home after school.",
        "Dog in the home.",
        "Parent present for all sessions.",
      ]) : null,
      status,
      assessmentCompletedAt: daysAgo(waiting),
      waitingSince: daysAgo(waiting),
      hubspotId: String(hsId++),
      hubspotSyncStatus: null as string | null,
      ...over,
    } satisfies Prisma.CaseCreateManyInput;
    cases.push(c);
    return c;
  }

  // --- staff (80) --------------------------------------------------------------
  const staffPlan: [string, number][] = [["NY", 35], ["NJ", 25], ["CO", 20]];
  const staff: (Prisma.PersonCreateManyInput & { id: string; zipInfo: ZipInfo; caseSlots: string[][] })[] = [];
  let pN = 0;
  for (const [state, count] of staffPlan) {
    for (let i = 0; i < count; i++) {
      pN++;
      const zip = randomZip(state);
      const loc = jitter(zip);
      const placedDays = int(5, 175);
      const certified = chance(0.45);
      const s = {
        id: `person-${String(pN).padStart(3, "0")}`,
        kind: "STAFF" as const,
        ...identity(state),
        address: `${int(10, 999)} ${pick(STREETS)}, ${zip.city}, ${zip.state} ${zip.zip}`,
        city: zip.city, state, zip: zip.zip, lat: loc.lat, lng: loc.lng,
        certification: certified ? ("CERTIFIED" as const) : chance(0.3) ? ("IN_PROGRESS" as const) : ("NOT_CERTIFIED" as const),
        availability: personAvailability(),
        maxTravelMinutes: pick([30, 30, 45, 45, 60]),
        hasCar: state === "NY" ? chance(0.4) : chance(0.85),
        languages: languages(state),
        ageGroups: AGE_GROUPS.filter(() => chance(0.5)),
        earliestStart: null,
        appliedAt: daysAgo(placedDays + int(9, 48)),
        formCompletedAt: daysAgo(placedDays + 8),
        screenedAt: daysAgo(placedDays + 7),
        applicationSentAt: daysAgo(placedDays + 6),
        inServicesSentAt: daysAgo(placedDays + 5),
        hiredAt: daysAgo(placedDays + 1),
        placedAt: daysAgo(placedDays),
        checklist: fullChecklist(),
        source: "apploi-hubspot",
        workdayEmployeeId: `W-${10000 + pN}`,
        zipInfo: zip,
        caseSlots: [] as string[][],
      };
      staff.push(s);
    }
  }

  // 55 staff carry a current case. ~15 of those are fully booked (no open hours).
  staff.forEach((s, i) => {
    if (i % 16 >= 11) return; // roughly 25 of 80 have no current case
    const fullyBooked = i % 16 < 3;
    const avail = s.availability as string[];
    const slots = fullyBooked ? avail : avail.filter(() => chance(0.45)).slice(0, 5);
    if (!slots.length) slots.push(avail[0]);
    const placed = s.placedAt as Date;
    const c = makeCase(nearbyZip(s.zipInfo, 5), "STAFFED", {
      slots,
      hoursPerWeek: slots.length * 3,
      languageRequired: null,
      rbtRequired: s.certification === "CERTIFIED" && chance(0.4),
      assessmentCompletedAt: new Date(placed.getTime() - int(4, 30) * DAY),
      waitingSince: new Date(placed.getTime() - int(4, 30) * DAY),
      staffedAt: placed,
      hubspotSyncStatus: "ok",
    });
    s.caseSlots.push(slots);
    assignments.push({
      caseId: c.id, personId: s.id, role: "PRIMARY", status: "ACTIVE",
      createdById: pickPlacer(), createdAt: placed, via: "manual",
    });
  });

  // --- open cases (40): 33 needs staffing + 7 restaffing -----------------------------
  const openPlan: [string, number, number][] = [["NY", 14, 3], ["NJ", 10, 2], ["CO", 9, 2]];
  const openCases: ReturnType<typeof makeCase>[] = [];
  for (const [state, needs, restaff] of openPlan) {
    for (let i = 0; i < needs; i++) openCases.push(makeCase(randomZip(state), "NEEDS_STAFFING"));
    for (let i = 0; i < restaff; i++) {
      const since = int(1, 12);
      openCases.push(
        makeCase(randomZip(state), "RESTAFFING", {
          assessmentCompletedAt: daysAgo(int(60, 200)),
          waitingSince: daysAgo(since),
        }),
      );
    }
  }
  // --- discharged (5) -----------------------------------------------------------------
  for (const state of ["NY", "NY", "NJ", "CO", "CO"]) {
    makeCase(randomZip(state), "DISCHARGED", {
      assessmentCompletedAt: daysAgo(int(120, 300)),
      dischargedAt: daysAgo(int(3, 60)),
    });
  }

  // --- applicants (150) -----------------------------------------------------------------
  const stagePlan: [string, number][] = [
    ["APPLIED", 25], ["FORM_COMPLETED", 30], ["SCREENED", 20], ["APPLICATION_SENT", 18],
    ["IN_SERVICES_SENT", 20], ["PAPERWORK_COMPLETE", 7], ["READY_TO_PLACE", 30],
  ];
  const stateCycle = ["NY", "NJ", "CO", "NY", "NJ", "NY", "CO", "NY", "NJ", "CO", "NY", "NJ", "NY", "CO", "NY"];
  const applicants: (Prisma.PersonCreateManyInput & { id: string })[] = [];
  let aN = 0;
  for (const [stage, count] of stagePlan) {
    for (let i = 0; i < count; i++) {
      pN++;
      const state = stateCycle[aN++ % stateCycle.length];
      // Most ready applicants live near an open case; everyone else is scattered.
      const anchor = openCases.filter((c) => c.state === state);
      const anchorZip = pick(anchor).zip;
      const zip =
        stage === "READY_TO_PLACE" && chance(0.8)
          ? nearbyZip(ZIPS.find((z) => z.zip === anchorZip)!, 4)
          : randomZip(state);
      const loc = jitter(zip);
      const applied = stage === "APPLIED" ? int(0, 21) : int(4, 55);
      const step = (n: number) => daysAgo(Math.max(0, applied - n));
      const idx = stagePlan.findIndex(([s]) => s === stage);
      const formDone = idx >= 1;
      const noLocation = !formDone && chance(0.2);
      const id = `person-${String(pN).padStart(3, "0")}`;
      const ident = identity(state);
      const contactId = String(hsId++);
      const a = {
        id,
        kind: "APPLICANT" as const,
        ...ident,
        address: formDone && chance(0.7) ? `${int(10, 999)} ${pick(STREETS)}, ${zip.city}, ${zip.state} ${zip.zip}` : null,
        city: noLocation ? null : zip.city,
        state: noLocation ? null : state,
        zip: noLocation ? null : zip.zip,
        lat: noLocation ? null : loc.lat,
        lng: noLocation ? null : loc.lng,
        certification: formDone
          ? chance(0.25) ? ("CERTIFIED" as const) : chance(0.3) ? ("IN_PROGRESS" as const) : ("NOT_CERTIFIED" as const)
          : ("NOT_CERTIFIED" as const),
        availability: formDone ? personAvailability() : [],
        maxTravelMinutes: formDone ? pick([15, 30, 30, 45, 45, 60]) : 30,
        hasCar: formDone ? (state === "NY" ? chance(0.35) : chance(0.8)) : false,
        languages: formDone ? languages(state) : [],
        ageGroups: idx >= 2 ? AGE_GROUPS.filter(() => chance(0.35)) : [],
        earliestStart: formDone ? new Date(NOW + int(-10, 21) * DAY) : null,
        appliedAt: daysAgo(applied),
        formCompletedAt: idx >= 1 ? step(1) : null,
        screenedAt: idx >= 2 ? step(3) : null,
        applicationSentAt: idx >= 3 ? step(4) : null,
        inServicesSentAt: idx >= 4 ? step(6) : null,
        hiredAt: idx >= 6 ? step(12) : null,
        placedAt: null,
        checklist: idx >= 5 ? fullChecklist() : idx >= 3 ? partialChecklist() : {},
        source: "apploi-hubspot",
        hubspotContactId: contactId,
        apploiId: `APL-${50000 + pN}`,
        workdayEmployeeId: idx >= 6 ? `W-${10000 + pN}` : null,
        recruiterId: chance(0.5) ? "user-recruiter" : chance(0.5) ? "user-recruiter2" : "user-offshore",
      };
      applicants.push(a);
      hubspot.push({
        id: contactId,
        objectType: "contacts",
        properties: {
          [K.firstName]: ident.firstName, [K.lastName]: ident.lastName, [K.mobile]: ident.mobile,
          [K.email]: ident.email, [K.zip]: noLocation ? "" : zip.zip, [K.apploiId]: a.apploiId,
          [K.created]: a.appliedAt.toISOString(),
        },
      });
    }
  }

  // Denormalised stage + ready
  const finish = (p: Prisma.PersonCreateManyInput) => {
    const r = computeReadiness({
      kind: p.kind as "APPLICANT" | "STAFF",
      formCompletedAt: (p.formCompletedAt as Date) ?? null, screenedAt: (p.screenedAt as Date) ?? null,
      applicationSentAt: (p.applicationSentAt as Date) ?? null, inServicesSentAt: (p.inServicesSentAt as Date) ?? null,
      hiredAt: (p.hiredAt as Date) ?? null, placedAt: (p.placedAt as Date) ?? null,
      checklist: p.checklist, availability: (p.availability as string[]) ?? [],
      lat: p.lat ?? null, lng: p.lng ?? null,
    });
    return { ...p, stage: r.stage, ready: r.ready };
  };
  for (const s of staff) {
    const { zipInfo: _z, caseSlots: _c, ...row } = s;
    void _z; void _c;
    people.push(finish(row));
  }
  for (const a of applicants) people.push(finish(a));

  // --- backups on open cases ---------------------------------------------------------------
  const readyApplicants = applicants.filter((a) => finish(a).ready);
  const openStaff = staff.filter((s) => openSlots(s.availability as string[], s.caseSlots).length > 0);
  const near = (k: { lat?: number | null; lng?: number | null; state?: string | null }) => {
    const c = { lat: k.lat as number, lng: k.lng as number };
    return [...openStaff, ...readyApplicants]
      .filter((p) => p.state === k.state && p.lat != null)
      .sort((a, b) => haversineMiles({ lat: a.lat!, lng: a.lng! }, c) - haversineMiles({ lat: b.lat!, lng: b.lng! }, c));
  };
  const backedUp = new Set<string>();
  openCases.forEach((c, i) => {
    const isRestaffing = c.status === "RESTAFFING";
    const n = isRestaffing ? int(1, 3) : i % 6 === 0 ? int(1, 2) : 0;
    const picks = near(c).filter((p) => !backedUp.has(p.id)).slice(0, n);
    picks.forEach((p, j) => {
      backedUp.add(p.id);
      const attached = int(2, 26);
      assignments.push({
        caseId: c.id, personId: p.id, role: "BACKUP", status: "ACTIVE",
        createdById: pickPlacer(), createdAt: daysAgo(attached),
        expiresAt: new Date(NOW + (BACKUP_DAYS - attached) * DAY), via: j === 0 ? "outreach" : "manual",
      });
    });
    if (isRestaffing) {
      // The primary who left: an ended assignment, for history.
      const former = staff.find((s) => s.state === c.state && s.caseSlots.length === 0 && !backedUp.has(s.id));
      if (former) {
        assignments.push({
          caseId: c.id, personId: former.id, role: "PRIMARY", status: "ENDED",
          createdById: pickPlacer(), createdAt: daysAgo(int(60, 150)),
          endedAt: c.waitingSince as Date, endReason: "restaffing", via: "manual",
        });
      }
    }
  });

  // --- mock HubSpot case records ----------------------------------------------------------------
  const primaryByCase = new Map(
    assignments.filter((a) => a.role === "PRIMARY" && a.status === "ACTIVE").map((a) => [a.caseId, a.personId]),
  );
  for (const c of cases) {
    const primary = people.find((p) => p.id === primaryByCase.get(c.id as string));
    hubspot.push({
      id: c.hubspotId!,
      objectType: "cases",
      properties: {
        [C.code]: c.code, [C.clientLabel]: c.clientLabel, [C.address]: c.address, [C.city]: c.city,
        [C.state]: c.state, [C.zip]: c.zip, [C.slots]: (c.slots as string[]).join(";"),
        [C.hoursPerWeek]: String(c.hoursPerWeek), [C.languageRequired]: c.languageRequired ?? "",
        [C.ageGroup]: c.ageGroup, [C.rbtRequired]: String(c.rbtRequired), [C.notes]: c.notes ?? "",
        [C.assessmentCompletedAt]: (c.assessmentCompletedAt as Date).toISOString().slice(0, 10),
        [C.status]: HUBSPOT_STATUS_VALUES[c.status as keyof typeof HUBSPOT_STATUS_VALUES],
        ...(primary
          ? {
              [C.primaryName]: `${primary.firstName} ${primary.lastName}`,
              [C.primaryPhone]: primary.mobile ?? "", [C.primaryEmail]: primary.email ?? "",
            }
          : {}),
      },
    });
  }

  // Records that exist in (mock) HubSpot but have NOT been pulled in yet, so
  // pressing "Run sync" on the Integrations screen visibly does something.
  for (const state of ["NY", "NJ", "CO", "NY", "NJ", "CO"]) {
    const zip = randomZip(state);
    const ident = identity(state);
    hubspot.push({
      id: String(hsId++),
      objectType: "contacts",
      properties: {
        [K.firstName]: ident.firstName, [K.lastName]: ident.lastName, [K.mobile]: ident.mobile,
        [K.email]: ident.email, [K.zip]: zip.zip, [K.apploiId]: `APL-${60000 + hsId}`,
        [K.created]: new Date(NOW).toISOString(),
      },
    });
  }
  for (const state of ["NY", "NJ", "CO"]) {
    const zip = randomZip(state);
    caseN++;
    hubspot.push({
      id: String(hsId++),
      objectType: "cases",
      properties: {
        [C.code]: `UC-${state}-${caseN}`, [C.clientLabel]: `Client ${caseN}`,
        [C.address]: `${int(10, 999)} ${pick(STREETS)}, ${zip.city}, ${state} ${zip.zip}`,
        [C.city]: zip.city, [C.state]: state, [C.zip]: zip.zip,
        [C.slots]: "MON_PM;WED_PM;FRI_PM", [C.hoursPerWeek]: "9", [C.languageRequired]: "",
        [C.ageGroup]: "CHILD", [C.rbtRequired]: "false", [C.notes]: "New from HubSpot sync.",
        [C.assessmentCompletedAt]: new Date(NOW - DAY).toISOString().slice(0, 10),
        [C.status]: "needs_staffing",
      },
    });
  }

  console.log("Writing rows...");
  await prisma.person.createMany({ data: people });
  await prisma.case.createMany({ data: cases });
  await prisma.assignment.createMany({ data: assignments });
  await prisma.mockHubspotObject.createMany({ data: hubspot });

  // --- one outreach in progress, so the Outreach screen has something to show ---------------------
  const demoCase = openCases.find((c) => c.status === "NEEDS_STAFFING" && c.state === "NY")!;
  const shortlist = near(demoCase).filter((p) => !backedUp.has(p.id)).slice(0, 4);
  if (shortlist.length) {
    const body = `United Care ABA: a case is starting near you in ${demoCase.city}, ${demoCase.state}, about ${demoCase.hoursPerWeek} hrs/week. Interested? Reply YES or NO.`;
    const campaign = await prisma.outreachCampaign.create({
      data: { caseId: demoCase.id, body, createdById: "user-recruiter", createdAt: daysAgo(1) },
    });
    for (const [i, p] of shortlist.entries()) {
      const replied = i === 0 ? "YES" : i === 1 ? "NO" : null;
      await prisma.outreachRecipient.create({
        data: {
          campaignId: campaign.id, personId: p.id, sentAt: daysAgo(1),
          status: replied === "YES" ? "YES" : replied === "NO" ? "NO" : "SENT",
          proposedRole: replied === "YES" ? "PRIMARY" : null,
          repliedAt: replied ? daysAgo(0.9) : null,
          replyText: replied === "YES" ? "Yes, I'm interested!" : replied === "NO" ? "No thanks, too far for me" : null,
        },
      });
      await prisma.message.create({
        data: {
          personId: p.id, direction: "out", phone: p.mobile as string, body, kind: "outreach",
          campaignId: campaign.id, createdAt: daysAgo(1),
        },
      });
      if (replied) {
        await prisma.message.create({
          data: {
            personId: p.id, direction: "in", phone: p.mobile as string, kind: "outreach_reply",
            body: replied === "YES" ? "Yes, I'm interested!" : "No thanks, too far for me",
            campaignId: campaign.id, createdAt: daysAgo(0.9),
          },
        });
      }
    }
  }

  const counts = {
    users: await prisma.user.count(),
    applicants: await prisma.person.count({ where: { kind: "APPLICANT" } }),
    readyApplicants: await prisma.person.count({ where: { kind: "APPLICANT", ready: true } }),
    staff: await prisma.person.count({ where: { kind: "STAFF" } }),
    openCases: await prisma.case.count({ where: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } } }),
    allCases: await prisma.case.count(),
    assignments: await prisma.assignment.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
