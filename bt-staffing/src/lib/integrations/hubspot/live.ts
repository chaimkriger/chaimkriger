import {
  HUBSPOT_PROPS,
  type HubSpotAdapter,
  type HubSpotCase,
  type HubSpotContact,
  type StaffingWriteBack,
  propsToCase,
  propsToContact,
  staffingToProperties,
} from "./types";

type FetchLike = typeof fetch;

interface SearchResponse {
  results: { id: string; properties: Record<string, unknown> }[];
  paging?: { next?: { after: string } };
}

/**
 * Real HubSpot adapter: CRM v3 object API, authenticated with a private app
 * token (Authorization: Bearer ...). Turn on with HUBSPOT_MODE=live and
 * HUBSPOT_PRIVATE_APP_TOKEN.
 *
 * Private app scopes needed:
 *   crm.objects.contacts.read
 *   crm.objects.deals.read + crm.objects.deals.write   (if cases are deals)
 *   or tickets / crm.objects.custom.read + .write       (if cases are tickets / a custom object)
 *
 * NOT YET RUN AGAINST A REAL PORTAL. The request shapes follow the public
 * CRM v3 API and are covered by unit tests with a fake fetch, but the property
 * names in HUBSPOT_PROPS must match your portal before this will work.
 */
export class LiveHubSpotAdapter implements HubSpotAdapter {
  readonly mode = "live" as const;
  private base = "https://api.hubapi.com";

  constructor(
    private token: string,
    private caseObject: string = "deals",
    private fetchImpl: FetchLike = fetch,
  ) {
    if (!token) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is required when HUBSPOT_MODE=live");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      // HubSpot rate limit: back off briefly and retry a few times.
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HubSpot ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
      }
      return (res.status === 204 ? undefined : await res.json()) as T;
    }
  }

  private async searchAll(
    objectType: string,
    properties: string[],
    filters: { propertyName: string; operator: string; value?: string }[],
  ) {
    const out: SearchResponse["results"] = [];
    let after: string | undefined;
    do {
      const page = await this.request<SearchResponse>("POST", `/crm/v3/objects/${objectType}/search`, {
        filterGroups: filters.length ? [{ filters }] : [],
        properties,
        limit: 100,
        after,
      });
      out.push(...page.results);
      after = page.paging?.next?.after;
    } while (after);
    return out;
  }

  async listApplicantContacts(since?: Date): Promise<HubSpotContact[]> {
    const P = HUBSPOT_PROPS.contact;
    const filters: { propertyName: string; operator: string; value?: string }[] = [
      { propertyName: P.applicantMarker, operator: "HAS_PROPERTY" },
    ];
    if (since) {
      filters.push({ propertyName: "lastmodifieddate", operator: "GTE", value: String(since.getTime()) });
    }
    const rows = await this.searchAll(
      "contacts",
      [P.firstName, P.lastName, P.mobile, P.phone, P.email, P.address, P.zip, P.apploiId, P.created],
      filters,
    );
    return rows.map((r) => propsToContact(r.id, r.properties));
  }

  async listCases(): Promise<HubSpotCase[]> {
    const P = HUBSPOT_PROPS.case;
    const rows = await this.searchAll(
      this.caseObject,
      [
        P.code, P.clientLabel, P.address, P.city, P.state, P.zip, P.slots, P.hoursPerWeek,
        P.languageRequired, P.ageGroup, P.rbtRequired, P.notes, P.assessmentCompletedAt, P.status,
      ],
      // Only records whose assessment is finished are cases waiting for a BT.
      [{ propertyName: P.assessmentCompletedAt, operator: "HAS_PROPERTY" }],
    );
    return rows.map((r) => propsToCase(r.id, r.properties));
  }

  async writeStaffing(caseHubspotId: string, staffing: StaffingWriteBack): Promise<void> {
    await this.request("PATCH", `/crm/v3/objects/${this.caseObject}/${encodeURIComponent(caseHubspotId)}`, {
      properties: staffingToProperties(staffing),
    });
  }
}
