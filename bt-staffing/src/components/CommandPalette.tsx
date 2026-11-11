"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { Avatar, CaseGlyph, cx, personTone } from "./ui";

interface Item {
  key: string;
  group: string;
  href: string;
  title: string;
  sub?: string;
  icon?: React.ReactNode;
}

interface SearchResponse {
  people: { id: string; firstName: string; lastName: string; kind: string; ready: boolean; city: string | null; state: string | null }[];
  cases: { id: string; code: string; status: string; city: string | null; state: string | null }[];
}

/** Search box in the top bar + Cmd/Ctrl+K palette: jump to any person, case or screen. */
export function CommandPalette({ pages }: { pages: { href: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResponse>({ people: [], cases: [] });
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults({ people: [], cases: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (r.ok) setResults(await r.json());
      } catch {
        /* aborted */
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  const items: Item[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out: Item[] = [];
    for (const p of results.people) {
      const name = `${p.firstName} ${p.lastName}`;
      out.push({
        key: `p-${p.id}`, group: "People", href: `/people/${p.id}`, title: name,
        sub: [p.kind === "STAFF" ? "Current staff" : p.ready ? "Ready" : "Not ready", [p.city, p.state].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
        icon: <Avatar name={name} tone={personTone(p.kind, p.ready)} size={26} />,
      });
    }
    for (const c of results.cases) {
      out.push({
        key: `c-${c.id}`, group: "Cases", href: `/cases/${c.id}`, title: c.code,
        sub: [c.status.replace("_", " ").toLowerCase(), [c.city, c.state].filter(Boolean).join(", ")].join(" · "),
        icon: <CaseGlyph status={c.status} size={26} />,
      });
    }
    for (const p of pages) {
      if (!term || p.label.toLowerCase().includes(term)) out.push({ key: `n-${p.href}`, group: "Go to", href: p.href, title: p.label });
    }
    return out;
  }, [results, pages, q]);

  useEffect(() => setIndex(0), [items.length]);

  const go = (item?: Item) => {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  let lastGroup = "";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-sm text-ink-3 transition hover:border-line-strong"
      >
        <Search size={15} />
        <span className="flex-1 truncate text-left">Search<span className="hidden sm:inline"> people and cases</span></span>
        <kbd className="hidden rounded-md border border-line bg-raised px-1.5 text-[0.68rem] font-medium text-ink-2 sm:block">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[1100] flex items-start justify-center bg-black/45 p-4 pt-[12vh] backdrop-blur-[2px] animate-in" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-label="Search" className="w-full max-w-xl animate-up overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-ink-3" />
              <input
                ref={input}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
                  else if (e.key === "Enter") { e.preventDefault(); go(items[index]); }
                }}
                placeholder="Name, phone, email, case code, city..."
                aria-label="Search people and cases"
                className="h-13 flex-1 bg-transparent py-4 text-base text-ink outline-none placeholder:text-ink-3"
              />
              {loading && <span className="text-xs text-ink-3">Searching</span>}
            </div>
            <ul className="scroll-thin max-h-[52vh] overflow-y-auto p-2" role="listbox">
              {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-3">{q.trim().length < 2 ? "Type at least two letters" : loading ? "Searching..." : "No matches"}</li>}
              {items.map((item, i) => {
                const heading = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={item.key} role="presentation">
                    {heading && <div className="px-3 pb-1 pt-3 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-3">{heading}</div>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === index}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => go(item)}
                      className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === index ? "bg-sunken" : "")}
                    >
                      {item.icon ?? <span className="h-[26px] w-[26px]" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        {item.sub && <span className="block truncate text-xs first-letter:uppercase text-ink-3">{item.sub}</span>}
                      </span>
                      {i === index && <CornerDownLeft size={14} className="text-ink-3" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
