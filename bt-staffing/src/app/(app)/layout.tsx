import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { CommandPalette } from "@/components/CommandPalette";
import { HelpGuide } from "@/components/HelpGuide";
import { MobileNav, type NavItem, SideNav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";

function Logo() {
  return (
    <Link href="/today" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-inverse text-[0.7rem] font-bold tracking-tight text-inverse-ink">UC</span>
      <span className="leading-tight">
        <span className="block text-[0.9rem] font-semibold tracking-[-0.01em] text-ink">BT Staffing</span>
        <span className="block text-[0.7rem] text-ink-3">United Care ABA</span>
      </span>
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [chase, ready, openCases, toConfirm] = await Promise.all([
    prisma.person.count({ where: { kind: "APPLICANT", ready: false } }),
    prisma.person.count({ where: { kind: "APPLICANT", ready: true } }),
    prisma.case.count({ where: { status: { in: ["NEEDS_STAFFING", "RESTAFFING"] } } }),
    prisma.outreachRecipient.count({ where: { status: "YES", confirmedAt: null } }),
  ]);
  const items: NavItem[] = [
    { href: "/today", label: "Today", icon: "today", mobile: true },
    { href: "/map", label: "Map", icon: "map", mobile: true },
    { href: "/queues/chase", label: "Chase", icon: "chase", group: "Work queues", count: chase, mobile: true },
    { href: "/queues/place", label: "Place", icon: "place", group: "Work queues", count: ready, mobile: true },
    { href: "/queues/open-cases", label: "Open cases", icon: "open", group: "Work queues", count: openCases, mobile: true },
    { href: "/applicants", label: "Pipeline", icon: "applicants", group: "Records" },
    { href: "/staff", label: "Staff", icon: "staff", group: "Records" },
    { href: "/cases", label: "Cases", icon: "cases", group: "Records" },
    { href: "/outreach", label: "Outreach", icon: "outreach", group: "Records", count: toConfirm, alert: true },
    { href: "/dashboard", label: "Insights", icon: "insights", group: "Records" },
  ];
  if (can(user.role, "integrations.manage")) items.push({ href: "/integrations", label: "Integrations", icon: "integrations", group: "Admin" });
  if (can(user.role, "users.view")) items.push({ href: "/admin/users", label: "Users", icon: "users", group: "Admin" });

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line">
        <div className="px-5 pb-1 pt-5"><Logo /></div>
        <div className="scroll-thin flex-1 overflow-y-auto pb-4 pt-3">
          <SideNav items={items} />
        </div>
        <div className="flex items-center gap-2.5 border-t border-line p-3">
          <Avatar name={user.name} size={30} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[0.83rem] font-medium text-ink">{user.name}</div>
            <div className="truncate text-[0.7rem] text-ink-3">{ROLE_LABELS[user.role]}</div>
          </div>
          <form action={logoutAction}>
            <button aria-label="Sign out" title="Sign out" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[900] flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur md:px-8">
          <div className="md:hidden"><Logo /></div>
          <div className="min-w-0 flex-1">
            <CommandPalette pages={items.map((i) => ({ href: i.href, label: i.label }))} />
          </div>
          <div className="flex items-center gap-1">
            <HelpGuide />
            <ThemeToggle />
            <form action={logoutAction} className="md:hidden">
              <button aria-label="Sign out" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken"><LogOut size={16} /></button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-[88rem] px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>
      <MobileNav items={items} />
    </div>
  );
}
