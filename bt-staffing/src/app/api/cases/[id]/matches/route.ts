import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadCandidates, rankForCase } from "@/lib/services/matchingService";

export const dynamic = "force-dynamic";

/** Top ready matches for one open case (used by the map). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await prisma.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "NEEDS_STAFFING" && c.status !== "RESTAFFING") return NextResponse.json({ matches: [], readyCount: 0 });
  const { ranked } = await rankForCase(c, await loadCandidates());
  const ready = ranked.filter((m) => m.candidate.ready);
  return NextResponse.json({
    readyCount: ready.length,
    matches: ready.slice(0, 8).map((m, i) => ({
      rank: i + 1,
      id: m.candidate.id,
      name: m.candidate.name,
      kind: m.candidate.kind,
      lat: m.candidate.lat,
      lng: m.candidate.lng,
      total: m.breakdown.total,
      driveMinutes: m.breakdown.driveMinutes,
      overlap: m.breakdown.overlapSlots.length,
      caseSlots: m.breakdown.caseSlotCount,
      driveScore: m.breakdown.driveScore,
      availabilityScore: m.breakdown.availabilityScore,
      requirementsScore: m.breakdown.requirementsScore,
    })),
  });
}
