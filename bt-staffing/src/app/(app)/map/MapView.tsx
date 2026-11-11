"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
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
  daysWaiting: number;
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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const select = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

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

  const center = cases.find((c) => c.id === centerCase) ?? null;

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

  // Redraw markers when the filters change.
  useEffect(() => {
    const leaflet = L.current;
    if (!mapReady || !leaflet || !layer.current) return;
    layer.current.clearLayers();
    const icon = (cls: string, glyph: string, size: number) =>
      leaflet.divIcon({ className: "", html: `<div class="${cls}"><span>${glyph}</span></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    if (center) {
      leaflet.circle([center.lat, center.lng], { radius: radius * 1609.34, color: "#1f63b8", weight: 1, fillOpacity: 0.06 }).addTo(layer.current);
    }
    for (const p of visible.people) {
      const s = STATUS.find((x) => x.key === p.type)!;
      const status = p.type === "ready" ? "Ready" : p.type === "notready" ? "Not ready" : "Current staff with open hours";
      const missing = p.missing.length ? `<br><span style="color:#b91c1c">Missing: ${esc(p.missing.slice(0, 4).join(", "))}${p.missing.length > 4 ? ", ..." : ""}</span>` : "";
      leaflet
        .marker([p.lat, p.lng], { icon: icon(s.pin, s.glyph, 22), title: p.name, zIndexOffset: p.type === "notready" ? 0 : 200 })
        .bindPopup(`<strong>${esc(p.name)}</strong><br>${status}${p.city ? ` · ${esc(p.city)}` : ""}${missing}<br><a href="/people/${p.id}">Open profile</a>`)
        .addTo(layer.current);
    }
    for (const c of visible.cases) {
      const s = STATUS.find((x) => x.key === c.status)!;
      const req = [c.rbtRequired ? "RBT required" : "", c.languageRequired ?? ""].filter(Boolean).join(", ");
      leaflet
        .marker([c.lat, c.lng], { icon: icon(s.pin, s.glyph, 24), title: c.code, zIndexOffset: 500 })
        .bindPopup(`<strong>${esc(c.code)}</strong><br>${c.status === "RESTAFFING" ? "Restaffing" : "Needs staffing"} · waiting ${c.daysWaiting} days${req ? `<br>${esc(req)}` : ""}<br><a href="/cases/${c.id}">Open case and ranked candidates</a>`)
        .addTo(layer.current);
    }
  }, [mapReady, visible, center, radius]);

  const count = (key: string) =>
    key === "NEEDS_STAFFING" || key === "RESTAFFING"
      ? visible.cases.filter((c) => c.status === key).length
      : visible.people.filter((p) => p.type === key).length;
  const caseOptions = cases.filter((c) => !state || c.state === state);

  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">State</span>
          <select className={`${select} w-full`} value={state} onChange={(e) => { setState(e.target.value); setCenterCase(""); }}>
            <option value="">All states</option>
            <option value="NY">New York (Brooklyn)</option>
            <option value="NJ">New Jersey</option>
            <option value="CO">Colorado (Denver)</option>
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status (also the legend)</legend>
          <div className="space-y-1.5">
            {STATUS.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={shown.includes(s.key)} onChange={() => setShown((v) => (v.includes(s.key) ? v.filter((x) => x !== s.key) : [...v, s.key]))} />
                <span className={s.pin} style={{ transform: s.key.includes("STAFFING") ? "rotate(45deg) scale(0.7)" : "scale(0.8)", boxShadow: "none" }}><span>{s.glyph}</span></span>
                <span className="flex-1">{s.label}</span>
                <span className="tabular-nums text-slate-500">{count(s.key)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Certification (people)</span>
          <select className={`${select} w-full`} value={cert} onChange={(e) => setCert(e.target.value)}>
            <option value="">Any</option>
            <option value="CERTIFIED">Certified (RBT)</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="NOT_CERTIFIED">Not certified</option>
          </select>
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</span>
          <div className="flex gap-2">
            <select aria-label="Day" className={`${select} flex-1`} value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Any day</option>
              {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
            </select>
            <select aria-label="Time of day" className={`${select} flex-1`} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="">Any time</option>
              {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Radius around a case</span>
          <select aria-label="Centre case" className={`${select} w-full`} value={centerCase} onChange={(e) => setCenterCase(e.target.value)}>
            <option value="">No radius filter</option>
            {caseOptions.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.city}</option>)}
          </select>
          <label className="mt-2 flex items-center gap-2">
            <input aria-label="Radius in miles" type="range" min={1} max={25} value={radius} disabled={!center} onChange={(e) => setRadius(Number(e.target.value))} className="flex-1" />
            <span className="w-14 text-right tabular-nums">{radius} mi</span>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Showing {visible.people.length} people and {visible.cases.length} cases.
          {unlocated > 0 && ` ${unlocated} applicants have no address yet and cannot be mapped.`}
        </p>
      </div>
      <div ref={el} className="h-[70vh] min-h-96 overflow-hidden rounded-lg border border-slate-200 bg-slate-100" role="application" aria-label="Staffing map" />
    </div>
  );
}
