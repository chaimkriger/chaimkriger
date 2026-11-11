import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import { Avatar, Badge, fmtDate, PageHeader, Table, Td } from "@/components/ui";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const user = await requireUser();
  if (!can(user.role, "users.view")) redirect("/today");
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in, and with which role. Users are created by the seed script today; see the README to add more." />
      <Table head={["Name", "Email", "Role", "Can do", "Created"]}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td><span className="flex items-center gap-2.5 whitespace-nowrap font-medium"><Avatar name={u.name} size={28} />{u.name}</span></Td>
            <Td className="text-ink-2">{u.email}</Td>
            <Td><Badge tone={u.role === "ADMIN" ? "staff" : "neutral"}>{ROLE_LABELS[u.role]}</Badge></Td>
            <Td className="text-xs text-ink-2">
              {u.role === "ADMIN"
                ? "Everything, plus integrations and users"
                : u.role === "RECRUITER"
                  ? "Pipeline, placements, outreach, case status"
                  : "Pipeline only (screening, paperwork, notes). Cannot place or text shortlists."}
            </Td>
            <Td className="whitespace-nowrap text-ink-2">{fmtDate(u.createdAt)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
