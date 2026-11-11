"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission, requireUser } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";
import { AGE_GROUPS, CHECKLIST_ITEMS, LANGUAGES, TRAVEL_OPTIONS } from "@/lib/constants";
import { cleanSlots } from "@/lib/availability";
import { refreshPerson } from "@/lib/services/people";
import { addBackup, assignPrimary, endAssignment, RuleError, setCaseStatus } from "@/lib/services/assignments";
import { syncCaseToHubSpot } from "@/lib/services/writeback";
import { confirmRecipient, recordReply, sendOutreach } from "@/lib/services/outreach";
import { runFullSync } from "@/lib/services/sync";
import { handleWorkdayPayload } from "@/lib/services/webhooks";
import { sendFormLink, submitForm } from "@/lib/intake/pipeline";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Run an action body and turn expected failures into a message for the UI. */
async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message: message || undefined };
  } catch (e) {
    if (e instanceof RuleError || e instanceof ForbiddenError || e instanceof z.ZodError) {
      return { ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid input" : e.message };
    }
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// --- auth ---------------------------------------------------------------------

export async function loginAction(input: { email: string; password: string; next: string }): Promise<ActionResult> {
  const email = String(input?.email ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  const next = String(input?.next ?? "");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { ok: false, error: "Wrong email or password." };
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  // Only follow same-site relative paths.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// --- pipeline --------------------------------------------------------------------

const MILESTONES = {
  screened: "screenedAt",
  applicationSent: "applicationSentAt",
  inServicesSent: "inServicesSentAt",
} as const;

export async function setMilestoneAction(personId: string, key: keyof typeof MILESTONES, done: boolean) {
  return run(async () => {
    await requirePermission("pipeline.edit");
    const field = MILESTONES[key];
    if (!field) throw new RuleError("Unknown step.");
    await prisma.person.update({ where: { id: personId }, data: { [field]: done ? new Date() : null } });
    await refreshPerson(personId);
  });
}

export async function setChecklistAction(personId: string, key: string, done: boolean) {
  return run(async () => {
    await requirePermission("pipeline.edit");
    if (!CHECKLIST_ITEMS.some((i) => i.key === key)) throw new RuleError("Unknown checklist item.");
    const p = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const checklist = { ...((p.checklist as Record<string, boolean>) ?? {}), [key]: done };
    await prisma.person.update({ where: { id: personId }, data: { checklist } });
    await refreshPerson(personId);
  });
}

export async function setAgeGroupsAction(personId: string, ageGroups: string[]) {
  return run(async () => {
    await requirePermission("pipeline.edit");
    const clean = AGE_GROUPS.filter((g) => ageGroups.includes(g));
    await prisma.person.update({ where: { id: personId }, data: { ageGroups: clean } });
  });
}

export async function addNoteAction(personId: string, body: string) {
  return run(async () => {
    const user = await requirePermission("pipeline.edit");
    const text = body.trim();
    if (!text) throw new RuleError("The note is empty.");
    await prisma.note.create({ data: { personId, authorId: user.id, body: text.slice(0, 2000) } });
  });
}

export async function resendFormLinkAction(personId: string) {
  return run(async () => {
    await requirePermission("pipeline.edit");
    const sent = await sendFormLink(personId);
    if (!sent) throw new RuleError("Could not send: no mobile number on file.");
    return "Form link texted.";
  });
}

// --- placement (always a recruiter's click) ---------------------------------------------

export async function assignPrimaryAction(caseId: string, personId: string) {
  return run(async () => {
    const user = await requirePermission("placement.make");
    await assignPrimary({ caseId, personId, userId: user.id });
    return "Placed as primary.";
  });
}

export async function addBackupAction(caseId: string, personId: string) {
  return run(async () => {
    const user = await requirePermission("placement.make");
    await addBackup({ caseId, personId, userId: user.id });
    return "Added as backup.";
  });
}

export async function endAssignmentAction(assignmentId: string) {
  return run(async () => {
    await requirePermission("placement.make");
    await endAssignment(assignmentId);
  });
}

export async function setCaseStatusAction(caseId: string, status: "RESTAFFING" | "DISCHARGED" | "NEEDS_STAFFING") {
  return run(async () => {
    await requirePermission("case.status");
    await setCaseStatus(caseId, status);
  });
}

export async function retryHubSpotAction(caseId: string) {
  return run(async () => {
    await requirePermission("placement.make");
    const r = await syncCaseToHubSpot(caseId);
    if (!r.ok) throw new RuleError(`HubSpot write failed: ${r.error}`);
    return "Written to HubSpot.";
  });
}

// --- outreach ----------------------------------------------------------------------------

export async function sendOutreachAction(caseId: string, personIds: string[], body: string) {
  let campaignId = "";
  const result = await run(async () => {
    const user = await requirePermission("outreach.send");
    const r = await sendOutreach({ caseId, personIds, body, userId: user.id });
    if (r.sent === 0) throw new RuleError(`Nothing was sent. ${r.failed.join(", ")}`);
    campaignId = r.campaignId;
  });
  if (result.ok && campaignId) redirect(`/outreach/${campaignId}`);
  return result;
}

export async function simulateReplyAction(recipientId: string, text: string) {
  return run(async () => {
    await requirePermission("outreach.send");
    if (!text.trim()) throw new RuleError("The reply is empty.");
    await recordReply(recipientId, text.trim().slice(0, 500));
  });
}

export async function confirmRecipientAction(recipientId: string, role: "PRIMARY" | "BACKUP") {
  return run(async () => {
    const user = await requirePermission("placement.make");
    await confirmRecipient(recipientId, role, user.id);
    return role === "PRIMARY" ? "Placed as primary." : "Added as backup.";
  });
}

// --- integrations (admin) ------------------------------------------------------------------

export async function runSyncAction() {
  return run(async () => {
    await requirePermission("integrations.manage");
    try {
      const r = await runFullSync();
      return `Sync finished: ${r.applicantsCreated} new applicant(s), ${r.applicantsUpdated} matched, ${r.casesCreated} new case(s), ${r.casesUpdated} case(s) updated, ${r.backupsExpired} backup(s) expired.`;
    } catch (e) {
      throw new RuleError(`Sync failed: ${(e as Error).message}`);
    }
  });
}

export async function simulateWorkdayHireAction(personId: string) {
  return run(async () => {
    await requirePermission("integrations.manage");
    const p = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const result = await handleWorkdayPayload({
      event: "hired",
      employeeId: `W-SIM-${Date.now().toString().slice(-6)}`,
      email: p.email,
      mobile: p.mobile,
      hireDate: new Date().toISOString(),
    });
    if (result.status !== 200 || !result.body.matched) throw new RuleError("Workday event did not match a profile.");
    return "Workday hire recorded.";
  });
}

// --- public applicant form (no login) --------------------------------------------------------------

const formSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  mobile: z.string().trim().min(7, "Mobile number is required").max(30),
  email: z.string().trim().min(3, "Email is required").max(120),
  addressOrZip: z.string().trim().min(5, "Enter your home address or ZIP code").max(200),
  certification: z.enum(["CERTIFIED", "IN_PROGRESS", "NOT_CERTIFIED"], { message: "Tell us if you are BT/RBT certified" }),
  availability: z.array(z.string()).max(21),
  maxTravelMinutes: z.number().int().refine((n) => TRAVEL_OPTIONS.includes(n), "Choose a travel time"),
  hasCar: z.boolean(),
  languages: z.array(z.string()).max(12),
  earliestStart: z.string().max(10),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
});

export async function submitApplyFormAction(input: unknown): Promise<ActionResult> {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const f = parsed.data;
  const availability = cleanSlots(f.availability);
  if (!availability.length) return { ok: false, error: "Tap at least one time you can work" };
  const languages = LANGUAGES.filter((l) => f.languages.includes(l));
  if (!languages.length) return { ok: false, error: "Choose at least one language" };
  const start = f.earliestStart ? new Date(`${f.earliestStart}T12:00:00Z`) : null;
  if (start && isNaN(start.getTime())) return { ok: false, error: "Start date is not valid" };
  try {
    await submitForm({
      firstName: f.firstName, lastName: f.lastName, mobile: f.mobile, email: f.email,
      addressOrZip: f.addressOrZip, certification: f.certification, availability,
      maxTravelMinutes: f.maxTravelMinutes, hasCar: f.hasCar, languages, earliestStart: start,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("Please enter")) return { ok: false, error: msg };
    console.error(e);
    return { ok: false, error: "We could not save your form. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Used by layouts to make sure the session is still valid. */
export async function whoAmI() {
  return requireUser();
}
