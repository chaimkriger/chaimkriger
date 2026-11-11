import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LiveHubSpotAdapter } from "@/lib/integrations/hubspot/live";
import { InMemoryMockHubSpotStore, MockHubSpotAdapter } from "@/lib/integrations/hubspot/mock";
import {
  HUBSPOT_PROPS, type StaffingWriteBack, propsToCase, staffingToProperties,
} from "@/lib/integrations/hubspot/types";
import { CHECKLIST_ITEMS } from "@/lib/constants";

const P = HUBSPOT_PROPS.case;

const staffing: StaffingWriteBack = {
  status: "STAFFED",
  primary: { name: "Pat Primary", mobile: "+17185550101", email: "pat@example.com" },
  backups: [
    { name: "Bea Backup", mobile: "+17185550102", email: null },
    { name: "Bo Backup", mobile: null, email: "bo@example.com" },
  ],
  staffedAt: new Date("2026-03-04T15:00:00Z"),
};

describe("write-back payload", () => {
  it("maps primary, backups, status and date onto HubSpot properties", () => {
    expect(staffingToProperties(staffing)).toEqual({
      [P.status]: "staffed",
      [P.primaryName]: "Pat Primary",
      [P.primaryPhone]: "+17185550101",
      [P.primaryEmail]: "pat@example.com",
      [P.backups]: "1. Bea Backup +17185550102\n2. Bo Backup bo@example.com",
      [P.staffedAt]: "2026-03-04",
    });
  });

  it("clears the fields when nobody is staffed", () => {
    const props = staffingToProperties({ status: "RESTAFFING", primary: null, backups: [], staffedAt: null });
    expect(props[P.status]).toBe("restaffing");
    expect(props[P.primaryName]).toBe("");
    expect(props[P.backups]).toBe("");
    expect(props[P.staffedAt]).toBe("");
  });
});

describe("mock adapter", () => {
  it("writes staffing onto the stored case and reads it back", async () => {
    const store = new InMemoryMockHubSpotStore();
    store.seed("cases", "9001", { [P.code]: "UC-NY-9001", [P.slots]: "MON_PM;WED_PM", [P.rbtRequired]: "true" });
    const adapter = new MockHubSpotAdapter(store);

    await adapter.writeStaffing("9001", staffing);

    const stored = (await store.get("9001"))!.properties;
    expect(stored[P.primaryName]).toBe("Pat Primary");
    expect(stored[P.code]).toBe("UC-NY-9001"); // untouched
    const [read] = await adapter.listCases();
    expect(read.status).toBe("STAFFED");
    expect(read.slots).toEqual(["MON_PM", "WED_PM"]);
    expect(read.rbtRequired).toBe(true);
  });

  it("fails loudly for an unknown case", async () => {
    const adapter = new MockHubSpotAdapter(new InMemoryMockHubSpotStore());
    await expect(adapter.writeStaffing("nope", staffing)).rejects.toThrow(/not found/);
  });
});

describe("live adapter (HubSpot CRM v3, fake fetch)", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("PATCHes the case object with a bearer token and the same payload as the mock", async () => {
    const fetchMock = vi.fn(async () => ok({ id: "555" }));
    const adapter = new LiveHubSpotAdapter("pat-secret", "deals", fetchMock as unknown as typeof fetch);

    await adapter.writeStaffing("555", staffing);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/deals/555");
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer pat-secret");
    expect(JSON.parse(init.body as string)).toEqual({ properties: staffingToProperties(staffing) });
  });

  it("honours a custom case object type", async () => {
    const fetchMock = vi.fn(async () => ok({}));
    const adapter = new LiveHubSpotAdapter("t", "2-1234567", fetchMock as unknown as typeof fetch);
    await adapter.writeStaffing("7", staffing);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain("/crm/v3/objects/2-1234567/7");
  });

  it("throws with the HubSpot status when the write is rejected", async () => {
    const fetchMock = vi.fn(async () => new Response('{"message":"Property bt_backups does not exist"}', { status: 400 }));
    const adapter = new LiveHubSpotAdapter("t", "deals", fetchMock as unknown as typeof fetch);
    await expect(adapter.writeStaffing("7", staffing)).rejects.toThrow(/400.*bt_backups/);
  });

  it("reads cases through the search endpoint and follows paging", async () => {
    const pages = [
      { results: [{ id: "1", properties: { [P.code]: "UC-1", [P.status]: "needs_staffing" } }], paging: { next: { after: "1" } } },
      { results: [{ id: "2", properties: { [P.code]: "UC-2", [P.status]: "restaffing" } }] },
    ];
    const fetchMock = vi.fn(async () => ok(pages.shift()));
    const adapter = new LiveHubSpotAdapter("t", "deals", fetchMock as unknown as typeof fetch);

    const cases = await adapter.listCases();

    expect(cases.map((c) => [c.code, c.status])).toEqual([["UC-1", "NEEDS_STAFFING"], ["UC-2", "RESTAFFING"]]);
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/deals/search");
    expect(JSON.parse(init.body as string).after).toBe("1");
  });

  it("refuses to start without a token", () => {
    expect(() => new LiveHubSpotAdapter("")).toThrow(/HUBSPOT_PRIVATE_APP_TOKEN/);
  });

  it("parses HubSpot case properties", () => {
    const c = propsToCase("3", { [P.slots]: "MON_AM; TUE_EVE", [P.rbtRequired]: "false", [P.hoursPerWeek]: "12" });
    expect(c.slots).toEqual(["MON_AM", "TUE_EVE"]);
    expect(c.rbtRequired).toBe(false);
    expect(c.hoursPerWeek).toBe(12);
    expect(c.status).toBe("NEEDS_STAFFING");
  });
});

// ---------------------------------------------------------------------------
// End to end against the mock: a recruiter placement in this app ends up on
// the HubSpot case record. Needs a database (DATABASE_URL_TEST).
// ---------------------------------------------------------------------------
const hasDb = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hasDb)("end to end: placement > HubSpot (mock) write-back", () => {
  const tag = `t${Date.now()}`;
  const hsId = `hs-${tag}`;
  let prisma: typeof import("@/lib/db").prisma;
  let svc: typeof import("@/lib/services/assignments");
  let caseId: string;
  const ids: Record<string, string> = {};

  const fullChecklist = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, true]));
  const hs = async () =>
    (await prisma.mockHubspotObject.findUniqueOrThrow({ where: { id: hsId } })).properties as Record<string, string>;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    svc = await import("@/lib/services/assignments");
    const { refreshPerson } = await import("@/lib/services/people");

    await prisma.mockHubspotObject.create({
      data: { id: hsId, objectType: "cases", properties: { [P.code]: `UC-${tag}`, [P.status]: "needs_staffing" } },
    });
    caseId = (
      await prisma.case.create({
        data: {
          code: `UC-${tag}`, clientLabel: "Test client", hubspotId: hsId,
          lat: 40.65, lng: -73.95, slots: ["MON_PM", "WED_PM"],
        },
      })
    ).id;
    const d = new Date();
    for (const [i, key] of ["primary", "b1", "b2", "b3", "b4", "b5", "notReady"].entries()) {
      const p = await prisma.person.create({
        data: {
          firstName: key, lastName: tag, mobile: `+1999${String(Date.now()).slice(-6)}${i}`,
          email: `${key}.${tag}@example.com`, lat: 40.66, lng: -73.94, availability: ["MON_PM", "WED_PM"],
          formCompletedAt: d, screenedAt: d, applicationSentAt: d, inServicesSentAt: d, hiredAt: d,
          checklist: key === "notReady" ? {} : fullChecklist,
        },
      });
      await refreshPerson(p.id);
      ids[key] = p.id;
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.case.deleteMany({ where: { code: `UC-${tag}` } });
    await prisma.person.deleteMany({ where: { lastName: tag } });
    await prisma.mockHubspotObject.deleteMany({ where: { id: hsId } });
    await prisma.$disconnect();
  });

  it("refuses to place someone who is not ready, and writes nothing", async () => {
    await expect(svc.assignPrimary({ caseId, personId: ids.notReady, userId: null })).rejects.toThrow(/not ready/);
    expect((await hs())[P.primaryName]).toBeUndefined();
  });

  it("backups are written back, up to 4", async () => {
    for (const k of ["b1", "b2", "b3", "b4"]) await svc.addBackup({ caseId, personId: ids[k], userId: null });
    await expect(svc.addBackup({ caseId, personId: ids.b5, userId: null })).rejects.toThrow(/at most 4/);
    const props = await hs();
    expect(props[P.backups].split("\n")).toHaveLength(4);
    expect(props[P.backups]).toContain(`b1 ${tag}`);
    expect(props[P.status]).toBe("needs_staffing");
  });

  it("placing the primary writes primary + backups and marks the case staffed", async () => {
    await svc.assignPrimary({ caseId, personId: ids.primary, userId: null });

    const props = await hs();
    expect(props[P.status]).toBe("staffed");
    expect(props[P.primaryName]).toBe(`primary ${tag}`);
    expect(props[P.primaryEmail]).toBe(`primary.${tag}@example.com`);
    expect(props[P.backups].split("\n")).toHaveLength(4);
    expect(props[P.staffedAt]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe("STAFFED");
    expect(c.hubspotSyncStatus).toBe("ok");
    const person = await prisma.person.findUniqueOrThrow({ where: { id: ids.primary } });
    expect(person.kind).toBe("STAFF");
    expect(person.stage).toBe("PLACED");
    const log = await prisma.integrationLog.findFirst({
      where: { system: "hubspot", action: "write_staffing", summary: { contains: `UC-${tag}` } },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.status).toBe("ok");
  });

  it("a second primary is refused while the case is staffed", async () => {
    await expect(svc.assignPrimary({ caseId, personId: ids.b5, userId: null })).rejects.toThrow(/already has a primary/);
  });

  it("restaffing clears the primary in HubSpot and keeps the backups", async () => {
    await svc.setCaseStatus(caseId, "RESTAFFING");
    const props = await hs();
    expect(props[P.status]).toBe("restaffing");
    expect(props[P.primaryName]).toBe("");
    expect(props[P.backups].split("\n")).toHaveLength(4);
  });

  it("promoting a backup to primary removes them from the backup list", async () => {
    await svc.assignPrimary({ caseId, personId: ids.b1, userId: null });
    const props = await hs();
    expect(props[P.primaryName]).toBe(`b1 ${tag}`);
    expect(props[P.backups].split("\n")).toHaveLength(3);
    expect(props[P.backups]).not.toContain(`b1 ${tag}`);
  });

  it("a backup placed elsewhere is released from this case", async () => {
    const other = await prisma.case.create({
      data: { code: `UC-${tag}`.replace("UC-", "UX-"), clientLabel: "Other", lat: 40.65, lng: -73.95, slots: ["MON_PM"] },
    });
    try {
      await svc.assignPrimary({ caseId: other.id, personId: ids.b2, userId: null });
      const props = await hs();
      expect(props[P.backups]).not.toContain(`b2 ${tag}`);
      expect(props[P.backups].split("\n")).toHaveLength(2);
    } finally {
      await prisma.case.delete({ where: { id: other.id } });
    }
  });

  it("backups past 30 days are expired and removed from HubSpot", async () => {
    await prisma.assignment.updateMany({
      where: { caseId, personId: ids.b3, role: "BACKUP" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await svc.sweepExpiredBackups()).toBeGreaterThanOrEqual(1);
    const props = await hs();
    expect(props[P.backups]).not.toContain(`b3 ${tag}`);
    expect(props[P.backups]).toContain(`b4 ${tag}`);
  });

  it("a HubSpot failure is recorded on the case and does not undo the placement", async () => {
    const { syncCaseToHubSpot } = await import("@/lib/services/writeback");
    const failing = new MockHubSpotAdapter(new InMemoryMockHubSpotStore()); // empty store > 404
    const result = await syncCaseToHubSpot(caseId, failing);
    expect(result.ok).toBe(false);
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.hubspotSyncStatus).toBe("error");
    expect(c.status).toBe("STAFFED");
  });
});
