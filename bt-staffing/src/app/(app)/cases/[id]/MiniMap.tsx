"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export interface MiniPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tone: "ready" | "notready" | "staff";
  rank: number;
}

/** Small live map for one case: the case diamond plus ranked candidates. */
export function MiniMap({ center, restaffing, pins, activeId, onPick }: { center: { lat: number; lng: number }; restaffing: boolean; pins: MiniPin[]; activeId: string | null; onPick: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lng], 12);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit to the case and the candidates whenever the list changes.
  useEffect(() => {
    const leaflet = L.current;
    if (!ready || !leaflet || !map.current) return;
    const points: [number, number][] = [[center.lat, center.lng], ...pins.slice(0, 12).map((p) => [p.lat, p.lng] as [number, number])];
    map.current.fitBounds(leaflet.latLngBounds(points).pad(0.25), { maxZoom: 14 });
  }, [ready, pins, center.lat, center.lng]);

  useEffect(() => {
    const leaflet = L.current;
    if (!ready || !leaflet || !layer.current) return;
    layer.current.clearLayers();
    // Lines follow the theme: dark ink on light tiles, light ink on dark tiles.
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#17171b";
    const active = pins.find((p) => p.id === activeId);
    if (active) {
      leaflet.polyline([[active.lat, active.lng], [center.lat, center.lng]], { color: ink, weight: 2, dashArray: "5 6", opacity: 0.8 }).addTo(layer.current);
    }
    for (const p of [...pins].reverse()) {
      const isActive = p.id === activeId;
      const cls = `pin pin-${p.tone}${isActive ? " pin-rank" : activeId ? " pin-dim" : ""}`;
      leaflet
        .marker([p.lat, p.lng], {
          title: `#${p.rank} ${p.name}`,
          zIndexOffset: isActive ? 900 : 100 - p.rank,
          icon: leaflet.divIcon({ className: "", html: `<div class="${cls}"><span>${p.rank}</span></div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        })
        .on("click", () => pick.current(p.id))
        .addTo(layer.current);
    }
    leaflet
      .marker([center.lat, center.lng], {
        title: "This case",
        zIndexOffset: 1000,
        interactive: false,
        icon: leaflet.divIcon({ className: "", html: `<div class="pin pin-case${restaffing ? " pin-restaffing" : ""}"><span>${restaffing ? "R" : "C"}</span></div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      })
      .addTo(layer.current);
  }, [ready, pins, activeId, center.lat, center.lng, restaffing]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl bg-sunken" role="application" aria-label="Map of this case and its ranked candidates" />;
}
