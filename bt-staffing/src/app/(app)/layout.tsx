import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { Nav, type NavItem } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/map", label: "Map" },
    { href: "/queues/chase", label: "Chase", group: "Work queues" },
    { href: "/queues/place", label: "Place", group: "Work queues" },
    { href: "/queues/open-cases", label: "Open cases", group: "Work queues" },
    { href: "/applicants", label: "Applicants", group: "Records" },
    { href: "/staff", label: "Staff", group: "Records" },
    { href: "/cases", label: "Cases", group: "Records" },
    { href: "/outreach", label: "Outreach", group: "Records" },
  ];
  if (can(user.role, "integrations.manage")) items.push({ href: "/integrations", label: "Integrations", group: "Admin" });
  if (can(user.role, "users.view")) items.push({ href: "/admin/users", label: "Users", group: "Admin" });

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-slate-800 text-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col">
        <div className="flex items-center justify-between px-4 pt-3 md:block md:pt-5">
          <div>
            <div className="text-sm font-semibold">United Care ABA</div>
            <div className="text-xs text-slate-300">BT Staffing</div>
          </div>
          <form action={logoutAction} className="md:hidden">
            <button className="rounded px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-500">Sign out</button>
          </form>
        </div>
        <div className="md:flex-1 md:overflow-y-auto">
          <Nav items={items} />
        </div>
        <div className="hidden border-t border-slate-700 p-4 md:block">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-slate-300">{ROLE_LABELS[user.role]}</div>
          <form action={logoutAction}>
            <button className="mt-2 rounded px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-500 hover:bg-slate-700">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
