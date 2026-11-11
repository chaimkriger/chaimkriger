import type { Metadata } from "next";
import Link from "next/link";
import { Kanban, List, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { config } from "@/lib/config";
import { STAGE_HELP, STAGES, STAGE_LABELS } from "@/lib/constants";
import { nextStep } from "@/lib/nextStep";
import { readinessOf } from "@/lib/services/people";
import { formatMobile } from "@/lib/normalize";
import { NextStepButton } from "@/components/NextStepButton";
import { Avatar, CertBadge, cx, daysSince, FilterTabs, MissingList, PageHeader, PersonLink, personTone, ReadyBadge, StageBadge, Table, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Pipeline" };

const COLUMN_LIMIT = 12;

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string; state?: string; view?: string }> }) {
  const { stage = "", q = "", state = "", view = "" } = await searchParams;
  const user = await requireUser();
  const canEdit = can(user.role, "pipeline.edit");
  const all = await prisma.person.findMany({ where: { kind: "APPLICANT" }, orderBy: { appliedAt: "asc" }, include: { recruiter: true } });
  const needle = q.trim().toLowerCase();
  const filtered = all.filter(
    (p) =>
      (!state || p.state === state) &&
      (!needle || `${p.firstName} ${p.lastName} ${p.email ?? ""} ${p.mobile ?? ""} ${p.zip ?? ""}`.toLowerCase().includes(needle)),
  );
  const stages = STAGES.filter((s) => s !== "PLACED");
  const label = (s: string) => (s === "APPLIED" ? "Form not completed" : STAGE_LABELS[s as keyof typeof STAGE_LABELS]);
  // The board is the default; choosing a stage or "list" shows the table.
  const isList = view === "list" || !!stage;
  const rows = filtered.filter((p) => !stage || p.stage === stage);
  const qs = (extra: Record<string, string>) => {
    const u = new URLSearchParams({ ...(q ? { q } : {}), ...(state ? { state } : {}), ...extra });
    return u.toString() ? `/applicants?${u}` : "/applicants";
  };

  return (
    <>
      <PageHeader title="Pipeline" subtitle="Every applicant, grouped by how far along they are. The button on each card is the next thing to do for that person. Once someone is placed they move to Staff.">
        <div className="inline-flex gap-0.5 rounded-xl bg-sunken p-1">
          <Link href={qs({})} aria-current={!isList ? "true" : undefined} className={cx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-medium", !isList ? "bg-surface text-ink shadow-sm" : "text-ink-2")}><Kanban size={14} /> Board</Link>
          <Link href={qs({ view: "list" })} aria-current={isList ? "true" : undefined} className={cx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-medium", isList ? "bg-surface text-ink shadow-sm" : "text-ink-2")}><List size={14} /> List</Link>
        </div>
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/applicants">
        {isList && <input type="hidden" name="view" value="list" />}
        {stage && <input type="hidden" name="stage" value={stage} />}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={q} placeholder="Filter by name, email, mobile, ZIP" aria-label="Filter applicants" className="field w-72 !pl-9" />
        </div>
        <select name="state" defaultValue={state} className="field !w-auto" aria-label="State">
          <option value="">All states</option>
          <option>NY</option><option>NJ</option><option>CO</option>
        </select>
        <button className="h-9 rounded-[10px] border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-raised">Apply</button>
        <span className="text-sm text-ink-3"><span className="num">{isList ? rows.length : filtered.length}</span> shown</span>
      </form>

      {!isList ? (
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
          <div className="flex gap-3" style={{ minWidth: `${stages.length * 17}rem` }}>
            {stages.map((s) => {
              const col = filtered.filter((p) => p.stage === s);
              return (
                <section key={s} data-column={s} className="flex w-[16.5rem] shrink-0 flex-col rounded-2xl bg-sunken/70 p-2">
                  <header className="px-2 pb-2 pt-1.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[0.8rem] font-semibold text-ink">{label(s)}</h2>
                      <span data-count className="num rounded-full bg-surface px-2 text-xs font-medium leading-5 text-ink-2">{col.length}</span>
                    </div>
                    <p className="mt-0.5 min-h-8 text-[0.7rem] leading-snug text-ink-3">{STAGE_HELP[s]}</p>
                  </header>
                  <ul className="space-y-2">
                    {col.slice(0, COLUMN_LIMIT).map((p) => {
                      const name = `${p.firstName} ${p.lastName}`;
                      const missing = readinessOf(p).missing;
                      return (
                        <li key={p.id} data-card className="rounded-xl border border-line bg-surface p-3 shadow-card">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name} tone={personTone(p.kind, p.ready)} size={30} />
                            <div className="min-w-0 flex-1 leading-tight">
                              <PersonLink id={p.id} name={name} />
                              <div className="truncate text-[0.7rem] text-ink-3">{p.city ?? "No address"} · {daysSince(p.appliedAt)}d in pipeline</div>
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <span className="text-[0.7rem] text-ink-3">{missing.length === 0 ? "Nothing missing" : `${missing.length} missing`}</span>
                            <NextStepButton personId={p.id} step={nextStep(p, config.requireWorkdayHire)} canEdit={canEdit} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {col.length > COLUMN_LIMIT && (
                    <Link href={qs({ stage: s })} className="mt-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium text-ink-2 hover:bg-surface">
                      Show all {col.length}
                    </Link>
                  )}
                  {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-3">Nobody here</p>}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <FilterTabs base="/applicants" param="stage" value={stage} extra={{ q, state, view: "list" }} options={[
              { value: "", label: "All", count: filtered.length },
              ...stages.map((s) => ({ value: s, label: label(s), count: filtered.filter((p) => p.stage === s).length })),
            ]} />
          </div>
          <Table head={["Name", "Status", "Stage", "Missing", "Certification", "Location", "Mobile", "Applied", "Recruiter"]} empty={!rows.length}>
            {rows.map((p) => (
              <tr key={p.id}>
                <Td>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Avatar name={`${p.firstName} ${p.lastName}`} tone={personTone(p.kind, p.ready)} size={26} />
                    <PersonLink id={p.id} name={`${p.firstName} ${p.lastName}`} />
                  </span>
                </Td>
                <Td><ReadyBadge ready={p.ready} /></Td>
                <Td><StageBadge stage={p.stage} /></Td>
                <Td><MissingList missing={readinessOf(p).missing} max={2} /></Td>
                <Td><CertBadge certification={p.certification} /></Td>
                <Td className="whitespace-nowrap text-ink-2">{[p.city, p.state].filter(Boolean).join(", ") || "-"}</Td>
                <Td className="num whitespace-nowrap text-ink-2">{formatMobile(p.mobile)}</Td>
                <Td className="num whitespace-nowrap text-ink-2">{daysSince(p.appliedAt)}d ago</Td>
                <Td className="whitespace-nowrap text-ink-2">{p.recruiter?.name ?? "-"}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
