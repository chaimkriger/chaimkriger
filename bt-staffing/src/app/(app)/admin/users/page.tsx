import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import { fmtDate, PageHeader, Table, Td } from "@/components/ui";

export default async function UsersPage() {
  const user = await requireUser();
  if (!can(user.role, "users.view")) redirect("/dashboard");
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in, and with which role. Users are created by the seed script today; see the README to add more." />
      <Table head={["Name", "Email", "Role", "Can do", "Created"]}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td className="font-medium">{u.name}</Td>
            <Td>{u.email}</Td>
            <Td>{ROLE_LABELS[u.role]}</Td>
            <Td className="text-xs text-slate-600">
              {u.role === "ADMIN"
                ? "Everything, plus integrations and users"
                : u.role === "RECRUITER"
                  ? "Pipeline, placements, outreach, case status"
                  : "Pipeline only (screening, paperwork, notes). Cannot place or text shortlists."}
            </Td>
            <Td className="whitespace-nowrap text-slate-600">{fmtDate(u.createdAt)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
