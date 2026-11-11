/**
 * HubSpot adapter contract. Two implementations:
 *   - MockHubSpotAdapter  (mock.ts)  default, backed by a local table
 *   - LiveHubSpotAdapter  (live.ts)  HubSpot CRM v3 API with a private app token
 * Switch with HUBSPOT_MODE=mock|live. The rest of the app only sees this file.
 */

export interface HubSpotContact {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
  zip: string | null;
  apploiId: string | null;
  createdAt: Date;
}

export interface HubSpotCase {
  id: string;
  code: string;
  clientLabel: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Slot keys, e.g. ["MON_PM", "WED_PM"] */
  slots: string[];
  hoursPerWeek: number | null;
  languageRequired: string | null;
  ageGroup: string | null;
  rbtRequired: boolean;
  notes: string | null;
  /** Normalised to our vocabulary. */
  status: "NEEDS_STAFFING" | "STAFFED" | "RESTAFFING" | "DISCHARGED";
  assessmentCompletedAt: Date | null;
}

export interface StaffingPerson {
  name: string;
  mobile: string | null;
  email: string | null;
}

/** What we write back to the case record in HubSpot. */
export interface StaffingWriteBack {
  status: "NEEDS_STAFFING" | "STAFFED" | "RESTAFFING" | "DISCHARGED";
  primary: StaffingPerson | null;
  backups: StaffingPerson[];
  staffedAt: Date | null;
}

export interface HubSpotAdapter {
  readonly mode: "mock" | "live";
  /** Applicant contacts created or changed since the given time (all when omitted). */
  listApplicantContacts(since?: Date): Promise<HubSpotContact[]>;
  /** Every case record we should know about. */
  listCases(): Promise<HubSpotCase[]>;
  /** Write primary + backups onto the case record. Throws on failure. */
  writeStaffing(caseHubspotId: string, staffing: StaffingWriteBack): Promise<void>;
}

/**
 * HubSpot property names. The contact names on the left are HubSpot defaults
 * except apploi_id. The case property names are OURS TO CHOOSE: create them in
 * HubSpot (Settings > Properties) on the case object, or edit this map to
 * point at properties that already exist.
 */
export const HUBSPOT_PROPS = {
  contact: {
    firstName: "firstname",
    lastName: "lastname",
    mobile: "mobilephone",
    phone: "phone",
    email: "email",
    address: "address",
    zip: "zip",
    apploiId: "apploi_id",
    created: "createdate",
    /** Contacts are treated as applicants when this property has a value. */
    applicantMarker: "apploi_id",
  },
  case: {
    code: "case_code",
    clientLabel: "client_label",
    address: "case_address",
    city: "case_city",
    state: "case_state",
    zip: "case_zip",
    /** Multi-checkbox; HubSpot returns "MON_PM;WED_PM" */
    slots: "bt_schedule",
    hoursPerWeek: "bt_hours_per_week",
    languageRequired: "bt_language_required",
    ageGroup: "client_age_group",
    rbtRequired: "rbt_required",
    notes: "staffing_notes",
    assessmentCompletedAt: "assessment_completed_date",
    // Written back by this app:
    status: "bt_staffing_status",
    primaryName: "bt_primary_name",
    primaryPhone: "bt_primary_phone",
    primaryEmail: "bt_primary_email",
    backups: "bt_backups",
    staffedAt: "bt_staffed_date",
  },
} as const;

/** Property values for bt_staffing_status in HubSpot. */
export const HUBSPOT_STATUS_VALUES: Record<StaffingWriteBack["status"], string> = {
  NEEDS_STAFFING: "needs_staffing",
  STAFFED: "staffed",
  RESTAFFING: "restaffing",
  DISCHARGED: "discharged",
};

export function formatBackups(backups: StaffingPerson[]): string {
  return backups
    .map((b, i) => `${i + 1}. ${b.name}${b.mobile ? ` ${b.mobile}` : ""}${b.email ? ` ${b.email}` : ""}`)
    .join("\n");
}

/** The exact property payload sent to HubSpot. Shared by mock and live. */
export function staffingToProperties(s: StaffingWriteBack): Record<string, string> {
  const P = HUBSPOT_PROPS.case;
  return {
    [P.status]: HUBSPOT_STATUS_VALUES[s.status],
    [P.primaryName]: s.primary?.name ?? "",
    [P.primaryPhone]: s.primary?.mobile ?? "",
    [P.primaryEmail]: s.primary?.email ?? "",
    [P.backups]: formatBackups(s.backups),
    // HubSpot date properties take midnight-UTC epoch millis or YYYY-MM-DD.
    [P.staffedAt]: s.staffedAt ? s.staffedAt.toISOString().slice(0, 10) : "",
  };
}

export function parseStatus(value: unknown): HubSpotCase["status"] {
  const v = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "staffed") return "STAFFED";
  if (v === "restaffing") return "RESTAFFING";
  if (v === "discharged") return "DISCHARGED";
  return "NEEDS_STAFFING";
}

export function propsToCase(id: string, p: Record<string, unknown>): HubSpotCase {
  const P = HUBSPOT_PROPS.case;
  const str = (k: string) => {
    const v = p[k];
    return v == null || v === "" ? null : String(v);
  };
  const date = (k: string) => {
    const v = str(k);
    if (!v) return null;
    const d = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };
  return {
    id,
    code: str(P.code) ?? `HS-${id}`,
    clientLabel: str(P.clientLabel) ?? `Case ${id}`,
    address: str(P.address),
    city: str(P.city),
    state: str(P.state),
    zip: str(P.zip),
    slots: (str(P.slots) ?? "").split(";").map((s) => s.trim()).filter(Boolean),
    hoursPerWeek: str(P.hoursPerWeek) ? Number(str(P.hoursPerWeek)) : null,
    languageRequired: str(P.languageRequired),
    ageGroup: str(P.ageGroup),
    rbtRequired: ["true", "yes", "1"].includes(String(p[P.rbtRequired] ?? "").toLowerCase()),
    notes: str(P.notes),
    status: parseStatus(p[P.status]),
    assessmentCompletedAt: date(P.assessmentCompletedAt),
  };
}

export function propsToContact(id: string, p: Record<string, unknown>): HubSpotContact {
  const P = HUBSPOT_PROPS.contact;
  const str = (k: string) => {
    const v = p[k];
    return v == null || v === "" ? null : String(v);
  };
  const created = str(P.created);
  return {
    id,
    firstName: str(P.firstName) ?? "",
    lastName: str(P.lastName) ?? "",
    mobile: str(P.mobile) ?? str(P.phone),
    email: str(P.email),
    address: str(P.address),
    zip: str(P.zip),
    apploiId: str(P.apploiId),
    createdAt: created ? new Date(created) : new Date(),
  };
}
