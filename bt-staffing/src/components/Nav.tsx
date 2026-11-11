"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  group?: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  let lastGroup: string | undefined;
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-visible md:px-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const heading = item.group && item.group !== lastGroup ? item.group : null;
        lastGroup = item.group;
        return (
          <div key={item.href} className="contents md:block">
            {heading && (
              <div className="hidden px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:block">{heading}</div>
            )}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-brand-600 font-medium text-white" : "text-slate-200 hover:bg-slate-700"}`}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
