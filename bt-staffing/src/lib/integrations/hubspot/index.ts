import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import type { Prisma } from "@prisma/client";
import { LiveHubSpotAdapter } from "./live";
import { MockHubSpotAdapter, type MockHubSpotStore } from "./mock";
import type { HubSpotAdapter } from "./types";

/** Mock store kept in Postgres so write-backs show up in the Integrations screen. */
export class PrismaMockHubSpotStore implements MockHubSpotStore {
  async list(objectType: "contacts" | "cases") {
    const rows = await prisma.mockHubspotObject.findMany({ where: { objectType } });
    return rows.map((r) => ({ id: r.id, properties: r.properties as Record<string, unknown> }));
  }
  async get(id: string) {
    const r = await prisma.mockHubspotObject.findUnique({ where: { id } });
    return r ? { id: r.id, properties: r.properties as Record<string, unknown> } : null;
  }
  async patch(id: string, properties: Record<string, unknown>) {
    const r = await prisma.mockHubspotObject.findUnique({ where: { id } });
    if (!r) throw new Error(`Mock HubSpot: object ${id} not found`);
    await prisma.mockHubspotObject.update({
      where: { id },
      data: { properties: { ...(r.properties as object), ...properties } as Prisma.InputJsonValue },
    });
  }
}

/** THE config switch: HUBSPOT_MODE=mock | live. */
export function getHubSpotAdapter(): HubSpotAdapter {
  if (config.hubspotMode === "live") {
    return new LiveHubSpotAdapter(config.hubspotToken, config.hubspotCaseObject);
  }
  return new MockHubSpotAdapter(new PrismaMockHubSpotStore());
}

export * from "./types";
