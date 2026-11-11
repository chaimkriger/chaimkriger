import { prisma } from "@/lib/db";
import type { HireEvent } from "@/lib/integrations/workday";
import { logIntegration } from "@/lib/integrations/log";
import { normalizeEmail, normalizeMobile } from "@/lib/normalize";
import { findPersonByContact } from "@/lib/intake/pipeline";
import { refreshPerson } from "./people";

/** Apply a Workday "hired" event to the matching profile. */
export async function applyHireEvent(e: HireEvent): Promise<{ matched: boolean; personId?: string }> {
  const person = await findPersonByContact(normalizeMobile(e.mobile), normalizeEmail(e.email));
  if (!person) {
    await logIntegration({
      system: "workday", direction: "in", action: "hired", status: "error",
      summary: `No profile matches Workday employee ${e.employeeId}`,
      payload: e,
    });
    return { matched: false };
  }
  await prisma.person.update({
    where: { id: person.id },
    data: { hiredAt: person.hiredAt ?? e.hireDate, workdayEmployeeId: e.employeeId },
  });
  await refreshPerson(person.id);
  await logIntegration({
    system: "workday", direction: "in", action: "hired", status: "ok",
    summary: `${person.firstName} ${person.lastName} marked hired (Workday ${e.employeeId})`,
  });
  return { matched: true, personId: person.id };
}
