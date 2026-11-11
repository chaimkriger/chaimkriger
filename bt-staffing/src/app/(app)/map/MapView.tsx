"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { ArrowUpRight, Crosshair, SlidersHorizontal, X } from "lucide-react";
import { buttonClass } from "@/components/button";
import { Avatar, Badge, CaseGlyph, cx, MissingList, Ring, ScoreBar, SlotGrid, WaitPill } from "@/components/ui";
import { DAYS, DAY_LABELS, PERIODS, PERIOD_LABELS } from "@/lib/constants";
import { haversineMiles } from "@/lib/geo/distance";

export interface MapPerson {
  id: string;
  name: string;
  type: "ready" | "notready" | "staff";
  state: string | null;
  city: string | null;
  lat: number;
  lng: number;
  certification: string;
  slots: string[];
  missing: string[];
}

export interface MapCase {
  id: string;
  code: string;
  status: "NEEDS_STAFFING" | "RESTAFFING";
  state: string | null;
  city: string | null;
  lat: number;
  lng: number;
  slots: string[];
  rbtRequired: boolean;
  languageRequired: string | null;
  hoursPerWeek: number;
  daysWaiting: number;
}

interface Match {
  rank: number;
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  total: number;
  driveMinutes: number;
  overlap: number;
  caseSlots: number;
  driveScore: number;
  availabilityScore: number;
  requirementsScore: number;
}

const STATUS = [
  { key: "ready", label: "Ready applicants", pin: "pin pin-ready", glyph: "✓" },
  { key: "notready", label: "Not ready applicants", pin: "pin pin-notready", glyph: "!" },
  { key: "staff", label: "Current staff, open hours", pin: "pin pin-staff", glyph: "S" },
  { key: "NEEDS_STAFFING", label: "Case: needs staffing", pin: "pin pin-case", glyph: "C" },
  { key: "RESTAFFING", label: "Case: restaffing", pin: "pin pin-case pin-restaffing", glyph: "R" },
] as const;

const CENTERS: Record<string, [number, number, number]> = {
  NY: [40.65, -73.95, 12],
  NJ: [40.74, -74.15, 10],
  CO: [39.73, -104.96, 11],
};

const label = "mb-1.5 block text-[0.68rem] font-medium uppercase tracking-[0.08em] text-ink-3";

export function MapView({ people, cases, unlocated }: { people: MapPerson[]; cases: MapCase[]; unlocated: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [state, setState] = useState("NY");
  const [shown, setShown] = useState<string[]>(STATUS.map((s) => s.key));
  const [cert, setCert] = useState("");
  const [day, setDay] = useState("");
  const [period, setPeriod] = useState("");
  const [centerCase, setCenterCase] = useState("");
  const [radius, setRadius] = useState(5);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selected, setSelected] = useState<{ type: "case" | "person"; id: string } | null>(null);
  const [matches, setMatches] = useState<{ caseId: string; list: Match[]; readyCount: number } | null>(null);
  const select = useRef(setSelected);

  const center = cases.find((c) => c.id === centerCase) ?? null;
  const selCase = selected?.type === "case" ? cases.find((c) => c.id === selected.id) ?? null : null;
  const selPerson = selected?.type === "person" ? people.find((p) => p.id === selected.id) ?? null : null;
  const activeMatches = selCase && matches?.caseId === selCase.id ? matches : null;

  const visible = useMemo(() => {
    const slotOk = (slots: string[]) =>
      (!day && !period) || slots.some((s) => (!day || s.startsWith(day + "_")) && (!period || s.endsWith("_" + period)));
    const inRadius = (p: { lat: number; lng: number }) => !center || haversineMiles(p, center) <= radius;
    const inState = (s: string | null) => !state || s === state;
    return {
      people: people.filter(
        (p) => shown.includes(p.type) && inState(p.state) && (!cert || p.certification === cert) && slotOk(p.slots) && inRadius(p),
      ),
      cases: cases.filter((c) => shown.includes(c.status) && inState(c.state) && slotOk(c.slots) && (c.id === centerCase || inRadius(c))),
    };
  }, [people, cases, shown, state, cert, day, period, center, centerCase, radius]);

  // Load the ranked ready matches for the selected case.
  useEffect(() => {
    if (!selCase) return;
    const ctl = new AbortController();
    fetch(`/api/cases/${selCase.id}/matches`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setMatches({ caseId: selCase.id, list: j.matches, readyCount: j.readyCount }))
      .catch(() => {});
    return () => ctl.abort();
  }, [selCase]);

  // Create the map once (Leaflet needs the browser, so it is loaded here).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { scrollWheelZoom: true }).setView([40.65, -73.95], 12);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
        .addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      m.on("click", () => select.current(null));
      map.current = m;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Move the view when the state or the radius centre changes.
  useEffect(() => {
    if (!mapReady || !map.current) return;
    if (center) map.current.setView([center.lat, center.lng], radius <= 3 ? 14 : radius <= 8 ? 13 : 11);
    else if (state && CENTERS[state]) map.current.setView([CENTERS[state][0], CENTERS[state][1]], CENTERS[state][2]);
    else map.current.setView([40.2, -89.5], 5);
  }, [mapReady, state, center, radius]);

  // Redraw markers when the filters or the selection change.
  useEffect(() => {
    const leaflet = L.current;
    if (!mapReady || !leaflet || !layer.current) return;
    layer.current.clearLayers();
    // Lines follow the theme: dark ink on light tiles, light ink on dark tiles.
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#17171b";
    const icon = (cls: string, glyph: string, size: number) =>
      leaflet.divIcon({ className: "", html: `<div class="${cls}"><span>${glyph}</span></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    if (center) {
      leaflet.circle([center.lat, center.lng], { radius: radius * 1609.34, color: ink, weight: 1, dashArray: "4 5", fillOpacity: 0.05, interactive: false }).addTo(layer.current);
    }
    const rankById = new Map((activeMatches?.list ?? []).map((m) => [m.id, m.rank]));
    if (selCase && activeMatches) {
      for (const m of activeMatches.list) {
        leaflet.polyline([[m.lat, m.lng], [selCase.lat, selCase.lng]], { color: ink, weight: m.rank === 1 ? 2.5 : 1.5, opacity: m.rank === 1 ? 0.9 : 0.45, dashArray: m.rank === 1 ? undefined : "4 6", interactive: false }).addTo(layer.current);
      }
    }
    for (const p of visible.people) {
      const s = STATUS.find((x) => x.key === p.type)!;
      const rank = rankById.get(p.id);
      const isSel = selPerson?.id === p.id;
      const cls = cx(s.pin, rank ? "pin-rank" : selCase ? "pin-dim" : "", isSel && "pin-selected");
      leaflet
        .marker([p.lat, p.lng], { icon: icon(cls, rank ? String(rank) : s.glyph, 22), title: p.name, zIndexOffset: rank ? 800 - rank : p.type === "notready" ? 0 : 200 })
        .on("click", (e) => {
          leaflet.DomEvent.stopPropagation(e);
          select.current({ type: "person", id: p.id });
        })
        .addTo(layer.current);
    }
    // Matches hidden by the filters are still drawn, so the ranking is never misleading.
    if (selCase && activeMatches) {
      for (const m of activeMatches.list) {
        if (visible.people.some((p) => p.id === m.id)) continue;
        leaflet
          .marker([m.lat, m.lng], { icon: icon(`pin ${m.kind === "STAFF" ? "pin-staff" : "pin-ready"} pin-rank`, String(m.rank), 22), title: m.name, zIndexOffset: 800 - m.rank })
          .on("click", (e) => {
            leaflet.DomEvent.stopPropagation(e);
            select.current({ type: "person", id: m.id });
          })
          .addTo(layer.current);
      }
    }
    for (const c of visible.cases) {
      const s = STATUS.find((x) => x.key === c.status)!;
      const cls = cx(s.pin, selCase && selCase.id !== c.id && "pin-dim", selCase?.id === c.id && "pin-selected");
      leaflet
        .marker([c.lat, c.lng], { icon: icon(cls, s.glyph, 26), title: c.code, zIndexOffset: selCase?.id === c.id ? 1000 : 500 })
        .on("click", (e) => {
          leaflet.DomEvent.stopPropagation(e);
          select.current({ type: "case", id: c.id });
        })
        .addTo(layer.current);
    }
  }, [mapReady, visible, center, radius, selCase, selPerson, activeMatches]);

  const count = (key: string) =>
    key === "NEEDS_STAFFING" || key === "RESTAFFING"
      ? visible.cases.filter((c) => c.status === key).length
      : visible.people.filter((p) => p.type === key).length;
  const caseOptions = cases.filter((c) => !state || c.state === state);
  const waitingList = [...visible.cases].sort((a, b) => b.daysWaiting - a.daysWaiting);

  return (
    <div className="grid gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)_20rem]">
      {/* Filters */}
      <div>
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={buttonClass("secondary", "md", "mb-2 w-full lg:hidden")} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={15} /> Filters and legend
        </button>
        <div className={cx("space-y-5 rounded-2xl border border-line bg-surface p-4 text-sm shadow-card lg:block", filtersOpen ? "block" : "hidden")}>
          <label className="block">
            <span className={label}>State</span>
            <select className="field" value={state} onChange={(e) => { setState(e.target.value); setCenterCase(""); setSelected(null); }}>
              <option value="">All states</option>
              <option value="NY">New York (Brooklyn)</option>
              <option value="NJ">New Jersey</option>
              <option value="CO">Colorado (Denver)</option>
            </select>
          </label>
          <fieldset>
            <legend className={label}>Status (also the legend)</legend>
            <div className="space-y-0.5">
              {STATUS.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-sunken">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={shown.includes(s.key)} onChange={() => setShown((v) => (v.includes(s.key) ? v.filter((x) => x !== s.key) : [...v, s.key]))} />
                  <span className="flex h-5 w-5 items-center justify-center">
                    <span className={s.pin} style={{ transform: s.key.includes("STAFFING") ? "rotate(45deg) scale(0.62)" : "scale(0.78)", boxShadow: "none" }}><span>{s.glyph}</span></span>
                  </span>
                  <span className="flex-1 text-[0.83rem] text-ink">{s.label}</span>
                  <span className="num text-xs text-ink-3">{count(s.key)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className={label}>Certification (people)</span>
            <select className="field" value={cert} onChange={(e) => setCert(e.target.value)}>
              <option value="">Any</option>
              <option value="CERTIFIED">Certified (RBT)</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="NOT_CERTIFIED">Not certified</option>
            </select>
          </label>
          <div>
            <span className={label}>Availability</span>
            <div className="flex gap-2">
              <select aria-label="Day" className="field" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">Any day</option>
                {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
              <select aria-label="Time of day" className="field" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="">Any time</option>
                {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className={label}>Radius around a case</span>
            <select aria-label="Centre case" className="field" value={centerCase} onChange={(e) => setCenterCase(e.target.value)}>
              <option value="">No radius filter</option>
              {caseOptions.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.city}</option>)}
            </select>
            <label className="mt-2.5 flex items-center gap-2.5">
              <input aria-label="Radius in miles" type="range" min={1} max={25} value={radius} disabled={!center} onChange={(e) => setRadius(Number(e.target.value))} className="flex-1 accent-[var(--ink)]" />
              <span className="num w-12 text-right text-ink">{radius} mi</span>
            </label>
          </div>
          <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
            Showing <span className="num text-ink-2">{visible.people.length}</span> people and <span className="num text-ink-2">{visible.cases.length}</span> cases.
            {unlocated > 0 && ` ${unlocated} applicants have no address yet and cannot be mapped.`}
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={el} className="h-[62dvh] min-h-96 overflow-hidden rounded-2xl border border-line bg-sunken shadow-card lg:h-[calc(100dvh-13.5rem)]" role="application" aria-label="Staffing map" />
      </div>

      {/* Detail panel */}
      <div className="lg:col-start-2 xl:col-start-3" data-panel>
        <div className="scroll-thin rounded-2xl border border-line bg-surface shadow-card xl:max-h-[calc(100dvh-13.5rem)] xl:overflow-y-auto">
          {selCase ? (
            <div className="p-4" data-panel-case>
              <div className="flex items-start gap-3">
                <CaseGlyph status={selCase.status} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="num text-base font-semibold text-ink">{selCase.code}</div>
                  <div className="text-xs text-ink-3">{selCase.city}, {selCase.state} · ~{selCase.hoursPerWeek} hrs/wk</div>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"><X size={16} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <WaitPill days={selCase.daysWaiting} />
                {selCase.status === "RESTAFFING" && <Badge tone="restaff">Restaffing</Badge>}
                {selCase.rbtRequired && <Badge>RBT required</Badge>}
                {selCase.languageRequired && <Badge>{selCase.languageRequired}</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Top ready matches</h3>
                {activeMatches && <span className="text-xs text-ink-3"><span className="num">{activeMatches.readyCount}</span> ready in total</span>}
              </div>
              {!activeMatches ? (
                <div className="mt-2 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
              ) : activeMatches.list.length === 0 ? (
                <p className="mt-2 rounded-xl bg-notready-soft p-3 text-sm text-notready-ink">Nobody ready can reach this case. Chase the red pins nearby.</p>
              ) : (
                <ol className="mt-2 space-y-1.5" data-matches>
                  {activeMatches.list.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setSelected({ type: "person", id: m.id })} className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2 text-left transition hover:border-ink">
                        <span className="num w-4 text-center text-xs font-semibold text-ink-3">{m.rank}</span>
                        <Avatar name={m.name} tone={m.kind === "STAFF" ? "staff" : "ready"} size={26} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.83rem] font-medium text-ink">{m.name}</span>
                          <span className="mt-1 block"><ScoreBar drive={m.driveScore} availability={m.availabilityScore} requirements={m.requirementsScore} /></span>
                          <span className="mt-0.5 block text-[0.68rem] text-ink-3">{m.driveMinutes} min · {m.overlap}/{m.caseSlots} hours</span>
                        </span>
                        <Ring value={m.total} size={34} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/cases/${selCase.id}`} className={buttonClass("primary", "md", "flex-1")}>Open matching workspace <ArrowUpRight size={15} /></Link>
                <button type="button" onClick={() => setCenterCase(selCase.id)} className={buttonClass("secondary", "md")} title={`Show only pins within ${radius} miles of this case`}>
                  <Crosshair size={15} /> {radius} mi
                </button>
              </div>
            </div>
          ) : selPerson ? (
            <div className="p-4" data-panel-person>
              <div className="flex items-start gap-3">
                <Avatar name={selPerson.name} tone={selPerson.type} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-ink">{selPerson.name}</div>
                  <div className="text-xs text-ink-3">{selPerson.city}, {selPerson.state}</div>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"><X size={16} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selPerson.type === "ready" && <Badge tone="ready">✓ Ready</Badge>}
                {selPerson.type === "notready" && <Badge tone="notready">! Not ready</Badge>}
                {selPerson.type === "staff" && <Badge tone="staff">Current staff with open hours</Badge>}
                {selPerson.certification === "CERTIFIED" && <Badge>RBT</Badge>}
              </div>
              {selPerson.missing.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Missing</h3>
                  <MissingList missing={selPerson.missing} max={8} />
                </div>
              )}
              <div className="mt-4">
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">{selPerson.type === "staff" ? "Open hours" : "Availability"}</h3>
                <SlotGrid slots={selPerson.slots} />
              </div>
              <Link href={`/people/${selPerson.id}`} className={buttonClass("primary", "md", "mt-4 w-full")}>Open profile <ArrowUpRight size={15} /></Link>
            </div>
          ) : (
            <div data-panel-list>
              <div className="px-4 pt-4">
                <h2 className="text-[0.93rem] font-semibold text-ink">Cases waiting in view</h2>
                <p className="mt-0.5 text-xs text-ink-3">Longest wait first. Pick one to draw its best matches on the map.</p>
              </div>
              {waitingList.length === 0 ? (
                <p className="p-4 text-sm text-ink-2">No open cases match these filters.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {waitingList.slice(0, 30).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { setSelected({ type: "case", id: c.id }); map.current?.panTo([c.lat, c.lng]); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-raised">
                        <CaseGlyph status={c.status} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="num block text-[0.85rem] font-medium text-ink">{c.code}</span>
                          <span className="block truncate text-xs text-ink-3">{c.city}{c.rbtRequired ? " · RBT" : ""}{c.languageRequired ? ` · ${c.languageRequired}` : ""}</span>
                        </span>
                        <WaitPill days={c.daysWaiting} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
