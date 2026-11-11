export type RoleKey = "RECRUITER" | "OFFSHORE_RECRUITER" | "ADMIN";

/**
 * What each role may do. Everyone signed in can VIEW every screen except
 * Integrations and Users (admin only).
 *
 *   pipeline.edit        screen people, tick paperwork, add notes, resend form link
 *   placement.make       place a primary, add/remove backups
 *   outreach.send        text a shortlist, log replies
 *   case.status          move a case to restaffing / discharged / reopen
 *   integrations.manage  run syncs, see integration logs, simulate Workday
 *   users.view           see the user list
 */
export type Permission =
  | "pipeline.edit"
  | "placement.make"
  | "outreach.send"
  | "case.status"
  | "integrations.manage"
  | "users.view";

const GRANTS: Record<RoleKey, Permission[]> = {
  // Offshore recruiters work the Chase queue: they move people toward Ready
  // but do not place anyone or text shortlists.
  OFFSHORE_RECRUITER: ["pipeline.edit"],
  RECRUITER: ["pipeline.edit", "placement.make", "outreach.send", "case.status"],
  ADMIN: ["pipeline.edit", "placement.make", "outreach.send", "case.status", "integrations.manage", "users.view"],
};

export function can(role: RoleKey, permission: Permission): boolean {
  return GRANTS[role]?.includes(permission) ?? false;
}
