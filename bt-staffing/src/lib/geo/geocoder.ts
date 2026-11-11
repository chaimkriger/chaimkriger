import { ZIP_INDEX } from "./zipdata";

/**
 * Geocoding interface. Today: mock that knows the seeded ZIP codes. To go
 * live, implement Geocoder against a real service (Azure Maps Search, Google
 * Geocoding, ...) and return it from getGeocoder().
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface Geocoder {
  readonly name: string;
  /** Accepts a full street address or just a ZIP. Returns null when not found. */
  geocode(addressOrZip: string): Promise<GeocodeResult | null>;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Finds a 5-digit ZIP in the text and returns that ZIP's centroid, nudged by a
 * stable offset derived from the address so pins in one ZIP do not stack.
 */
export class MockGeocoder implements Geocoder {
  readonly name = "mock-zip-centroid";
  async geocode(addressOrZip: string): Promise<GeocodeResult | null> {
    const text = (addressOrZip ?? "").trim();
    const zips = text.match(/\b\d{5}\b/g);
    if (!zips) return null;
    // A street number can also be 5 digits, so prefer the last known ZIP.
    const zip = [...zips].reverse().find((c) => ZIP_INDEX.has(c));
    if (!zip) return null;
    const info = ZIP_INDEX.get(zip)!;
    const h = hash(text.toLowerCase());
    const dLat = (((h & 0xffff) / 0xffff) - 0.5) * 0.012;
    const dLng = ((((h >>> 16) & 0xffff) / 0xffff) - 0.5) * 0.016;
    return {
      lat: +(info.lat + dLat).toFixed(5),
      lng: +(info.lng + dLng).toFixed(5),
      city: info.city,
      state: info.state,
      zip,
    };
  }
}

let geocoder: Geocoder | null = null;
export function getGeocoder(): Geocoder {
  if (!geocoder) geocoder = new MockGeocoder();
  return geocoder;
}
