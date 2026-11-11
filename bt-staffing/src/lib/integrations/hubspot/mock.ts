import {
  type HubSpotAdapter,
  type HubSpotCase,
  type HubSpotContact,
  type StaffingWriteBack,
  propsToCase,
  propsToContact,
  staffingToProperties,
} from "./types";

/** Minimal object store the mock sits on. Prisma-backed in the app, in-memory in tests. */
export interface MockHubSpotStore {
  list(objectType: "contacts" | "cases"): Promise<{ id: string; properties: Record<string, unknown> }[]>;
  get(id: string): Promise<{ id: string; properties: Record<string, unknown> } | null>;
  patch(id: string, properties: Record<string, unknown>): Promise<void>;
}

export class InMemoryMockHubSpotStore implements MockHubSpotStore {
  private rows = new Map<string, { objectType: string; properties: Record<string, unknown> }>();
  seed(objectType: "contacts" | "cases", id: string, properties: Record<string, unknown>) {
    this.rows.set(id, { objectType, properties: { ...properties } });
  }
  async list(objectType: "contacts" | "cases") {
    return [...this.rows.entries()]
      .filter(([, r]) => r.objectType === objectType)
      .map(([id, r]) => ({ id, properties: r.properties }));
  }
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? { id, properties: r.properties } : null;
  }
  async patch(id: string, properties: Record<string, unknown>) {
    const r = this.rows.get(id);
    if (!r) throw new Error(`Mock HubSpot: object ${id} not found`);
    r.properties = { ...r.properties, ...properties };
  }
}

/**
 * Behaves like the live adapter (same property names, same payload) but reads
 * and writes a local store instead of calling HubSpot.
 */
export class MockHubSpotAdapter implements HubSpotAdapter {
  readonly mode = "mock" as const;
  constructor(private store: MockHubSpotStore) {}

  async listApplicantContacts(since?: Date): Promise<HubSpotContact[]> {
    const rows = await this.store.list("contacts");
    return rows
      .map((r) => propsToContact(r.id, r.properties))
      .filter((c) => !since || c.createdAt >= since);
  }

  async listCases(): Promise<HubSpotCase[]> {
    const rows = await this.store.list("cases");
    return rows.map((r) => propsToCase(r.id, r.properties));
  }

  async writeStaffing(caseHubspotId: string, staffing: StaffingWriteBack): Promise<void> {
    const existing = await this.store.get(caseHubspotId);
    if (!existing) throw new Error(`Mock HubSpot: case ${caseHubspotId} not found (404)`);
    await this.store.patch(caseHubspotId, staffingToProperties(staffing));
  }
}
