import { prisma } from "@/lib/db";
import Link from "next/link";

/** Shared header for the three work queues, with live counts. */
export async function QueueTabs({ active }: { active: "chase" | "place" | "open-cases" }) {
  const [chase, ready, open] = await Promise.all([
    prisma.person.count({ where: { kind: "APPLICANT", ready: false } }),
    prisma.person.count({ where: { kind: "APPLICANT", ready: true } }),
    prisma.case.count({ where: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } } }),
  ]);
  const tabs = [
    { key: "chase", label: "Chase", count: chase },
    { key: "place", label: "Place", count: ready },
    { key: "open-cases", label: "Open cases", count: open },
  ];
  return (
    <div className="mb-5 inline-flex gap-0.5 rounded-xl bg-sunken p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/queues/${t.key}`}
          aria-current={t.key === active ? "page" : undefined}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${t.key === active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
        >
          {t.label} <span className="num ml-1 text-xs text-ink-3">{t.count}</span>
        </Link>
      ))}
    </div>
  );
}
