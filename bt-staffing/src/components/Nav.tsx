"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Briefcase, ClipboardList, LayoutDashboard, type LucideIcon, Map, MessageSquareText, PhoneCall,
  PlugZap, Rows3, ShieldCheck, Sparkles, UserCheck, Users,
} from "lucide-react";
import { cx } from "./ui";

const ICONS: Record<string, LucideIcon> = {
  today: Sparkles, map: Map, chase: PhoneCall, place: UserCheck, open: ClipboardList, applicants: Rows3, staff: Users,
  cases: Briefcase, outreach: MessageSquareText, insights: BarChart3, integrations: PlugZap, users: ShieldCheck, dash: LayoutDashboard,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  group?: string;
  count?: number;
  /** Draw the count as an attention pill instead of quiet text. */
  alert?: boolean;
  mobile?: boolean;
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  let lastGroup: string | undefined;
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const heading = item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        const Icon = ICONS[item.icon];
        return (
          <div key={item.href}>
            {heading && <div className="px-2.5 pb-1.5 pt-5 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-3">{heading}</div>}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[0.88rem] transition",
                active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-2 hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.3 : 1.9} className={active ? "text-ink" : "text-ink-3 group-hover:text-ink"} />
              <span className="flex-1">{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className={cx("num rounded-full px-1.5 text-[0.7rem] font-medium leading-5", item.alert ? "bg-inverse text-inverse-ink" : "text-ink-3")}>{item.count}</span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Phone: a fixed tab bar with the screens used on the go. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      {items.filter((i) => i.mobile).slice(0, 5).map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cx("relative flex flex-col items-center gap-0.5 py-2 text-[0.66rem]", active ? "font-semibold text-ink" : "text-ink-3")}>
            <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
            {item.label}
            {item.alert && item.count ? <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-notready" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
