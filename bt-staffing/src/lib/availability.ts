import { ALL_SLOTS, DAYS, DAY_LABELS, HOURS_PER_SLOT, PERIODS, PERIOD_LABELS } from "./constants";

const VALID = new Set(ALL_SLOTS);

export function cleanSlots(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];
  return ALL_SLOTS.filter((s) => slots.includes(s) && VALID.has(s));
}

export function intersect(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((s) => set.has(s));
}

/** Slots a person still has free after the cases they are primary on. */
export function openSlots(availability: string[], committedCaseSlots: string[][]): string[] {
  const taken = new Set(committedCaseSlots.flat());
  return availability.filter((s) => !taken.has(s));
}

export function slotsToHours(slots: string[]): number {
  return slots.length * HOURS_PER_SLOT;
}

/** "Mon PM, Tue PM/Eve" style summary for tables. */
export function describeSlots(slots: string[]): string {
  if (!slots.length) return "None";
  const short: Record<string, string> = { AM: "am", PM: "pm", EVE: "eve" };
  const parts: string[] = [];
  for (const d of DAYS) {
    const ps = PERIODS.filter((p) => slots.includes(`${d}_${p}`));
    if (ps.length === 3) parts.push(`${DAY_LABELS[d]} all day`);
    else if (ps.length) parts.push(`${DAY_LABELS[d]} ${ps.map((p) => short[p]).join("/")}`);
  }
  return parts.join(", ");
}

export function slotLabel(slot: string): string {
  const [d, p] = slot.split("_");
  return `${DAY_LABELS[d] ?? d} ${PERIOD_LABELS[p]?.toLowerCase() ?? p}`;
}
