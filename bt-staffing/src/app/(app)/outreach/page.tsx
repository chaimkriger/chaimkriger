import Link from "next/link";
import { prisma } from "@/lib/db";
import { CaseLink, fmtDate, PageHeader, Table, Td } from "@/components/ui";

export default async function OutreachListPage() {
  const campaigns = await prisma.outreachCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { case: true, createdBy: true, recipients: true },
  });
  return (
    <>
      <PageHeader title="Outreach" subtitle={'"Case starting near you" texts sent to shortlists, and the replies. Start a new one from a case\'s ranked list.'} />
      <Table head={["Sent", "Case", "By", "Texted", "Yes", "No", "Waiting", "To confirm", ""]} empty={!campaigns.length}>
        {campaigns.map((k) => {
          const n = (s: string) => k.recipients.filter((r) => r.status === s).length;
          const toConfirm = k.recipients.filter((r) => r.status === "YES" && !r.confirmedAt).length;
          return (
            <tr key={k.id}>
              <Td className="whitespace-nowrap">{fmtDate(k.createdAt)}</Td>
              <Td><CaseLink id={k.case.id} code={k.case.code} /></Td>
              <Td className="whitespace-nowrap text-slate-600">{k.createdBy?.name ?? "-"}</Td>
              <Td className="tabular-nums">{k.recipients.length}</Td>
              <Td className="tabular-nums">{n("YES")}</Td>
              <Td className="tabular-nums">{n("NO")}</Td>
              <Td className="tabular-nums">{n("SENT")}</Td>
              <Td className="tabular-nums">{toConfirm > 0 ? <span className="font-semibold text-amber-800">{toConfirm}</span> : 0}</Td>
              <Td><Link href={`/outreach/${k.id}`} className="font-medium text-brand-700 hover:underline">Open</Link></Td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
