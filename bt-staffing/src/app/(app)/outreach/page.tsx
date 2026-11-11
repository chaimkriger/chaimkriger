import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { prisma } from "@/lib/db";
import { buttonClass } from "@/components/button";
import { Badge, CaseGlyph, CaseLink, EmptyState, fmtShort, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Outreach" };

export default async function OutreachListPage() {
  const campaigns = await prisma.outreachCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { case: true, createdBy: true, recipients: true },
  });
  return (
    <>
      <PageHeader title="Outreach" subtitle={'"Case starting near you" texts sent to shortlists, and the replies. Start a new one from a case\'s ranked list.'} />
      {campaigns.length === 0 ? (
        <EmptyState icon={<MessageSquareText size={20} />} title="No outreach yet">Open a case, tick people in the ranked list and text the shortlist.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((k) => {
            const n = (s: string) => k.recipients.filter((r) => r.status === s).length;
            const toConfirm = k.recipients.filter((r) => r.status === "YES" && !r.confirmedAt).length;
            const total = Math.max(1, k.recipients.length);
            return (
              <li key={k.id} data-row className="grid items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto_auto]">
                <div className="flex items-center gap-3">
                  <CaseGlyph status={k.case.status} size={34} />
                  <div>
                    <CaseLink id={k.case.id} code={k.case.code} />
                    <div className="text-xs text-ink-3">{fmtShort(k.createdAt)} · {k.createdBy?.name ?? "Unknown"}</div>
                  </div>
                </div>
                <div>
                  <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${n("YES")} yes, ${n("NO")} no, ${n("OTHER")} unclear, ${n("SENT")} waiting`}>
                    <div className="bg-ready" style={{ width: `${(n("YES") / total) * 100}%` }} />
                    <div className="bg-notready" style={{ width: `${(n("NO") / total) * 100}%` }} />
                    <div className="bg-case" style={{ width: `${(n("OTHER") / total) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
                    <span><span className="num font-medium text-ink">{k.recipients.length}</span> texted</span>
                    <span><span className="num font-medium text-ink">{n("YES")}</span> yes</span>
                    <span><span className="num font-medium text-ink">{n("NO")}</span> no</span>
                    <span><span className="num font-medium text-ink">{n("SENT")}</span> waiting</span>
                  </div>
                </div>
                <div>{toConfirm > 0 ? <Badge tone="ready"><span className="num">{toConfirm}</span> to confirm</Badge> : <span className="text-xs text-ink-3">Nothing to confirm</span>}</div>
                <Link href={`/outreach/${k.id}`} className={buttonClass(toConfirm > 0 ? "primary" : "secondary")}>Open</Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
