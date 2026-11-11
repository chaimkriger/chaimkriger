import { prisma } from "@/lib/db";
import { STAGES } from "@/lib/constants";

const DAY = 86400_000;
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export async function dashboardData() {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [openCases, stageCounts, placements, placedPeople, users, readyStaffApplicants] = await Promise.all([
    prisma.case.findMany({ where: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } }, orderBy: { waitingSince: "asc" } }),
    prisma.person.groupBy({ by: ["stage"], where: { kind: "APPLICANT" }, _count: true }),
    prisma.assignment.findMany({ where: { role: "PRIMARY", createdAt: { gte: since } }, select: { createdAt: true, createdById: true } }),
    prisma.person.findMany({ where: { placedAt: { gte: since } }, select: { appliedAt: true, placedAt: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.person.count({ where: { kind: "APPLICANT", ready: true } }),
  ]);

  const waits = openCases.map((c) => Math.max(0, Math.floor((now.getTime() - c.waitingSince.getTime()) / DAY)));
  const buckets = [
    { label: "0-7 days", count: waits.filter((d) => d <= 7).length },
    { label: "8-14 days", count: waits.filter((d) => d > 7 && d <= 14).length },
    { label: "15-30 days", count: waits.filter((d) => d > 14 && d <= 30).length },
    { label: "Over 30 days", count: waits.filter((d) => d > 30).length },
  ];

  const stages = STAGES.filter((s) => s !== "PLACED").map((s) => ({
    stage: s,
    count: stageCounts.find((x) => x.stage === s)?._count ?? 0,
  }));

  const userName = new Map(users.map((u) => [u.id, u.name]));
  const byRecruiter = new Map<string, Record<string, number>>();
  for (const p of placements) {
    const name = p.createdById ? userName.get(p.createdById) ?? "Unknown" : "Unassigned";
    const row = byRecruiter.get(name) ?? {};
    const k = monthKey(p.createdAt);
    row[k] = (row[k] ?? 0) + 1;
    byRecruiter.set(name, row);
  }
  const recruiterRows = [...byRecruiter.entries()]
    .map(([name, row]) => ({ name, counts: months.map((m) => row[m] ?? 0), total: months.reduce((s, m) => s + (row[m] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total);

  const durations = placedPeople.map((p) => ({
    month: monthKey(p.placedAt!),
    days: Math.max(0, Math.round((p.placedAt!.getTime() - p.appliedAt.getTime()) / DAY)),
  }));
  const timeByMonth = months.map((m) => {
    const ds = durations.filter((d) => d.month === m).map((d) => d.days);
    return { month: m, median: median(ds), count: ds.length };
  });

  return {
    months,
    openCases,
    waits,
    buckets,
    avgWait: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
    maxWait: waits.length ? Math.max(...waits) : 0,
    stages,
    recruiterRows,
    placementsThisMonth: placements.filter((p) => monthKey(p.createdAt) === monthKey(now)).length,
    timeByMonth,
    medianAll: median(durations.map((d) => d.days)),
    placedCount: durations.length,
    readyApplicants: readyStaffApplicants,
  };
}
