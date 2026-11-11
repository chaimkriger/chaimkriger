import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { normalizeEmail, normalizeMobile } from "@/lib/normalize";
import { getSalesmsgAdapter } from "@/lib/integrations/salesmsg";
import { logIntegration } from "@/lib/integrations/log";
import { locate, refreshPerson } from "@/lib/services/people";
import type { IntakeApplicant } from "./types";

/** Find an existing profile for this applicant: mobile first, then email. */
export async function findPersonByContact(mobile: string | null, email: string | null) {
  if (mobile) {
    const byMobile = await prisma.person.findUnique({ where: { mobile } });
    if (byMobile) return byMobile;
  }
  if (email) {
    const byEmail = await prisma.person.findUnique({ where: { email } });
    if (byEmail) return byEmail;
  }
  return null;
}

export function formLink(): string {
  return `${config.appUrl}/apply`;
}

export async function sendFormLink(personId: string): Promise<boolean> {
  const p = await prisma.person.findUnique({ where: { id: personId } });
  if (!p?.mobile) return false;
  const body = `Hi ${p.firstName}, thanks for applying to United Care ABA! Please take 2 minutes to tell us your availability: ${formLink()}`;
  try {
    const { externalId } = await getSalesmsgAdapter().sendText({ to: p.mobile, body });
    await prisma.message.create({
      data: { personId: p.id, direction: "out", phone: p.mobile, body, kind: "form_link", externalId },
    });
    return true;
  } catch (e) {
    await logIntegration({
      system: "salesmsg", direction: "out", action: "send_form_link", status: "error",
      summary: `Could not text form link to ${p.firstName} ${p.lastName}: ${(e as Error).message}`,
    });
    return false;
  }
}

/**
 * Source-agnostic entry point: create the profile if it is new, otherwise fill
 * in blanks on the existing one. Never overwrites what the person typed into
 * the form. New profiles start at "Applied" (shown as "Form not completed").
 */
export async function ingestApplicant(a: IntakeApplicant): Promise<{ id: string; created: boolean }> {
  const mobile = normalizeMobile(a.mobile);
  const email = normalizeEmail(a.email);
  if (!mobile && !email) throw new Error("Applicant has neither a usable mobile nor an email");

  let existing = a.hubspotContactId
    ? await prisma.person.findUnique({ where: { hubspotContactId: a.hubspotContactId } })
    : null;
  if (!existing) existing = await findPersonByContact(mobile, email);

  if (existing) {
    // Only fill a contact field when no other profile already holds that value.
    const mobileFree = mobile && !existing.mobile && !(await prisma.person.findUnique({ where: { mobile } }));
    const emailFree = email && !existing.email && !(await prisma.person.findUnique({ where: { email } }));
    const hsFree =
      a.hubspotContactId &&
      !existing.hubspotContactId &&
      !(await prisma.person.findUnique({ where: { hubspotContactId: a.hubspotContactId } }));
    const needsLocation = existing.lat == null && (a.address || a.zip);
    const loc = needsLocation ? await locate(a.address, a.zip) : null;
    await prisma.person.update({
      where: { id: existing.id },
      data: {
        mobile: mobileFree ? mobile : undefined,
        email: emailFree ? email : undefined,
        hubspotContactId: hsFree ? a.hubspotContactId : undefined,
        apploiId: existing.apploiId ?? a.apploiId ?? undefined,
        address: existing.address ?? a.address ?? undefined,
        ...(loc ? { lat: loc.lat, lng: loc.lng, city: loc.city, state: loc.state, zip: loc.zip } : {}),
      },
    });
    await refreshPerson(existing.id);
    return { id: existing.id, created: false };
  }

  const loc = await locate(a.address, a.zip);
  const created = await prisma.person.create({
    data: {
      kind: "APPLICANT",
      firstName: a.firstName || "Unknown",
      lastName: a.lastName || "",
      mobile,
      email,
      address: a.address,
      zip: loc?.zip ?? a.zip,
      city: loc?.city,
      state: loc?.state,
      lat: loc?.lat,
      lng: loc?.lng,
      appliedAt: a.appliedAt ?? new Date(),
      source: a.source,
      hubspotContactId: a.hubspotContactId ?? null,
      apploiId: a.apploiId ?? null,
    },
  });
  await refreshPerson(created.id);
  if (config.sendFormLinkOnIntake) await sendFormLink(created.id);
  return { id: created.id, created: true };
}

export interface FormSubmission {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  addressOrZip: string;
  certification: "CERTIFIED" | "IN_PROGRESS" | "NOT_CERTIFIED";
  availability: string[];
  maxTravelMinutes: number;
  hasCar: boolean;
  languages: string[];
  earliestStart: Date | null;
}

/** Public form: create the profile, or update the one matched on mobile or email. */
export async function submitForm(f: FormSubmission): Promise<{ id: string; created: boolean }> {
  const mobile = normalizeMobile(f.mobile);
  const email = normalizeEmail(f.email);
  if (!mobile) throw new Error("Please enter a valid 10-digit mobile number");
  if (!email) throw new Error("Please enter a valid email address");

  const existing = await findPersonByContact(mobile, email);
  const loc = await locate(f.addressOrZip, null);
  const isZipOnly = /^\d{5}$/.test(f.addressOrZip.trim());
  const common = {
    firstName: f.firstName,
    lastName: f.lastName,
    address: isZipOnly ? null : f.addressOrZip.trim(),
    zip: loc?.zip ?? (isZipOnly ? f.addressOrZip.trim() : null),
    city: loc?.city ?? null,
    state: loc?.state ?? null,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    certification: f.certification,
    availability: f.availability,
    maxTravelMinutes: f.maxTravelMinutes,
    hasCar: f.hasCar,
    languages: f.languages,
    earliestStart: f.earliestStart,
  };

  if (existing) {
    // Keep the other contact field unless it is free to take.
    const mobileTaken = existing.mobile !== mobile && (await prisma.person.findUnique({ where: { mobile } }));
    const emailTaken = existing.email !== email && (await prisma.person.findUnique({ where: { email } }));
    await prisma.person.update({
      where: { id: existing.id },
      data: {
        ...common,
        mobile: mobileTaken ? undefined : mobile,
        email: emailTaken ? undefined : email,
        formCompletedAt: existing.formCompletedAt ?? new Date(),
      },
    });
    await refreshPerson(existing.id);
    return { id: existing.id, created: false };
  }

  const created = await prisma.person.create({
    data: { ...common, kind: "APPLICANT", mobile, email, source: "form", formCompletedAt: new Date() },
  });
  await refreshPerson(created.id);
  return { id: created.id, created: true };
}
