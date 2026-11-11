import { prisma } from "@/lib/db";
import { readinessOf } from "@/lib/services/people";
import { loadCandidates, loadOpenCases } from "@/lib/services/matchingService";
import { PageHeader } from "@/components/ui";
import { MapView, type MapCase, type MapPerson } from "./MapView";

export default async function MapPage() {
  const [rows, cases, unlocated] = await Promise.all([
    loadCandidates(),
    loadOpenCases(), // staffed and discharged cases are never loaded
    prisma.person.count({ where: { kind: "APPLICANT", lat: null } }),
  ]);
  const people: MapPerson[] = [];
  for (const r of rows) {
    const p = r.person;
    if (p.lat == null || p.lng == null) continue;
    if (p.kind === "STAFF") {
      // Staff appear only while they have open hours.
      if (r.candidate.openSlots.length === 0) continue;
      people.push({
        id: p.id, name: r.candidate.name, type: "staff", state: p.state, lat: p.lat, lng: p.lng,
        certification: p.certification, slots: r.candidate.openSlots, missing: [], city: p.city,
      });
    } else {
      people.push({
        id: p.id, name: r.candidate.name, type: p.ready ? "ready" : "notready", state: p.state, lat: p.lat, lng: p.lng,
        certification: p.certification, slots: p.availability, missing: p.ready ? [] : readinessOf(p).missing, city: p.city,
      });
    }
  }
  const mapCases: MapCase[] = cases
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({
      id: c.id, code: c.code, status: c.status as "NEEDS_STAFFING" | "RESTAFFING", state: c.state, city: c.city,
      lat: c.lat!, lng: c.lng!, slots: c.slots, rbtRequired: c.rbtRequired, languageRequired: c.languageRequired,
      daysWaiting: Math.max(0, Math.floor((Date.now() - c.waitingSince.getTime()) / 86400_000)),
    }));
  return (
    <>
      <PageHeader title="Map" subtitle="Applicants, current staff with open hours, and cases waiting for a BT. Staffed and discharged cases and fully booked staff are hidden." />
      <MapView people={people} cases={mapCases} unlocated={unlocated} />
    </>
  );
}
