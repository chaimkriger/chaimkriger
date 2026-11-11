import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Command palette search across people and cases. */
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ people: [], cases: [] });
  const words = q.split(/\s+/).filter(Boolean);
  const digits = q.replace(/\D/g, "");
  const [people, cases] = await Promise.all([
    prisma.person.findMany({
      where: {
        OR: [
          { AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })) },
          { email: { contains: q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : []),
        ],
      },
      select: { id: true, firstName: true, lastName: true, kind: true, ready: true, city: true, state: true, stage: true },
      take: 8,
      orderBy: [{ lastName: "asc" }],
    }),
    prisma.case.findMany({
      where: { OR: [{ code: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { clientLabel: { contains: q, mode: "insensitive" } }] },
      select: { id: true, code: true, status: true, city: true, state: true },
      take: 6,
      orderBy: { waitingSince: "asc" },
    }),
  ]);
  return NextResponse.json({ people, cases });
}
