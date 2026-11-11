import { getApploiAdapter } from "@/lib/integrations/apploi";
import { getHubSpotAdapter } from "@/lib/integrations/hubspot";
import type { IntakeApplicant, IntakeSource } from "./types";

/** Today's source: applicants land in HubSpot from Apploi; we read HubSpot contacts. */
export class ApploiHubSpotIntakeSource implements IntakeSource {
  readonly name = "apploi-hubspot";
  async fetchApplicants(since?: Date): Promise<IntakeApplicant[]> {
    const hubspot = getHubSpotAdapter();
    const apploi = getApploiAdapter();
    const contacts = await hubspot.listApplicantContacts(since);
    const out: IntakeApplicant[] = [];
    for (const c of contacts) {
      const application = c.apploiId ? await apploi.getApplication(c.apploiId).catch(() => null) : null;
      out.push({
        source: this.name,
        externalId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        mobile: c.mobile,
        email: c.email,
        address: c.address,
        zip: c.zip,
        appliedAt: application?.appliedAt ?? c.createdAt,
        hubspotContactId: c.id,
        apploiId: c.apploiId,
      });
    }
    return out;
  }
}

/**
 * Placeholder for the future career-page source. A career page would most
 * likely POST applicants to this app, in which case the route handler builds
 * an IntakeApplicant and calls ingestApplicant() directly.
 */
export class CareerPageIntakeSource implements IntakeSource {
  readonly name = "career-page";
  async fetchApplicants(): Promise<IntakeApplicant[]> {
    return [];
  }
}

export function getIntakeSource(): IntakeSource {
  return (process.env.INTAKE_SOURCE ?? "apploi-hubspot") === "career-page"
    ? new CareerPageIntakeSource()
    : new ApploiHubSpotIntakeSource();
}
