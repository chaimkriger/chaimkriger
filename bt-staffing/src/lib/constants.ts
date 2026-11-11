// Shared vocabulary. Pure data: safe to import from client components.

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const DAY_LABELS: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};
export const PERIODS = ["AM", "PM", "EVE"] as const;
export const PERIOD_LABELS: Record<string, string> = {
  AM: "Morning", PM: "Afternoon", EVE: "Evening",
};
export const ALL_SLOTS: string[] = DAYS.flatMap((d) => PERIODS.map((p) => `${d}_${p}`));
/** Rough hours in one grid cell; used only to describe open hours. */
export const HOURS_PER_SLOT = 3;

export const STAGES = [
  "APPLIED",
  "FORM_COMPLETED",
  "SCREENED",
  "APPLICATION_SENT",
  "IN_SERVICES_SENT",
  "PAPERWORK_COMPLETE",
  "READY_TO_PLACE",
  "PLACED",
] as const;
export type StageKey = (typeof STAGES)[number];
export const STAGE_LABELS: Record<StageKey, string> = {
  APPLIED: "Applied",
  FORM_COMPLETED: "Form completed",
  SCREENED: "Screened",
  APPLICATION_SENT: "Application sent",
  IN_SERVICES_SENT: "In-services sent",
  PAPERWORK_COMPLETE: "Paperwork complete",
  READY_TO_PLACE: "Ready to place",
  PLACED: "Placed",
};

/**
 * Paperwork checklist. Every item must be ticked before a person reaches
 * "Paperwork complete". Edit this list to match United Care's real packet.
 */
export const CHECKLIST_ITEMS = [
  { key: "application_returned", label: "Application returned", group: "Application" },
  { key: "inservices_completed", label: "In-services completed", group: "In-services" },
  { key: "i9", label: "I-9 and ID documents", group: "Paperwork" },
  { key: "w4", label: "W-4", group: "Paperwork" },
  { key: "background_check", label: "Background check cleared", group: "Paperwork" },
  { key: "references", label: "References checked", group: "Paperwork" },
  { key: "physical_tb", label: "Physical and TB test", group: "Paperwork" },
  { key: "direct_deposit", label: "Direct deposit form", group: "Paperwork" },
] as const;
export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

export const CASE_STATUS_LABELS: Record<string, string> = {
  NEEDS_STAFFING: "Needs staffing",
  STAFFED: "Staffed",
  RESTAFFING: "Restaffing",
  DISCHARGED: "Discharged",
};

export const CERT_LABELS: Record<string, string> = {
  CERTIFIED: "Certified (RBT)",
  IN_PROGRESS: "In progress",
  NOT_CERTIFIED: "Not certified",
};

export const AGE_GROUPS = ["EARLY", "CHILD", "TEEN", "ADULT"] as const;
export const AGE_GROUP_LABELS: Record<string, string> = {
  EARLY: "Early childhood (2-5)",
  CHILD: "School age (6-12)",
  TEEN: "Teen (13-17)",
  ADULT: "Adult (18+)",
};

export const LANGUAGES = [
  "English", "Spanish", "Russian", "Yiddish", "Hebrew", "Mandarin", "Arabic", "Haitian Creole", "Bengali",
];

export const STATES = ["NY", "NJ", "CO"] as const;

export const TRAVEL_OPTIONS = [15, 30, 45, 60, 90];

export const ROLE_LABELS: Record<string, string> = {
  RECRUITER: "Recruiter",
  OFFSHORE_RECRUITER: "Offshore recruiter",
  ADMIN: "Admin",
};

export const MAX_BACKUPS = 4;
export const BACKUP_DAYS = 30;
