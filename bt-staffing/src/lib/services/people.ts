import type { Person, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { computeReadiness, type Readiness, type ReadinessInput } from "@/lib/readiness";
import { getGeocoder } from "@/lib/geo/geocoder";

type Db = Prisma.TransactionClient | typeof prisma;

export function toReadinessInput(p: Person): ReadinessInput {
  return {
    kind: p.kind,
    formCompletedAt: p.formCompletedAt,
    screenedAt: p.screenedAt,
    applicationSentAt: p.applicationSentAt,
    inServicesSentAt: p.inServicesSentAt,
    hiredAt: p.hiredAt,
    placedAt: p.placedAt,
    checklist: p.checklist,
    availability: p.availability,
    lat: p.lat,
    lng: p.lng,
  };
}

export function readinessOf(p: Person): Readiness {
  return computeReadiness(toReadinessInput(p), { requireWorkdayHire: config.requireWorkdayHire });
}

/** Recompute the stored stage + ready flag after any change to a person. */
export async function refreshPerson(id: string, db: Db = prisma): Promise<Person> {
  const p = await db.person.findUniqueOrThrow({ where: { id } });
  const r = readinessOf(p);
  if (p.stage === r.stage && p.ready === r.ready) return p;
  return db.person.update({ where: { id }, data: { stage: r.stage, ready: r.ready } });
}

/** Geocode an address (or ZIP) into the location fields of a person or case. */
export async function locate(address: string | null, zip: string | null) {
  const query = [address, zip].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const hit = await getGeocoder().geocode(query);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng, city: hit.city, state: hit.state, zip: hit.zip ?? zip };
}
