import type { ConfirmSpec } from "./ActionButton";

/** Shared wording for the "place as primary" confirmation (used on server and client). */
export function placeConfirm(name: string, caseCode: string): ConfirmSpec {
  return {
    title: `Place ${name} on ${caseCode}?`,
    confirmLabel: "Place as primary",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li><strong className="text-ink">{name}</strong> becomes the primary BT and the case is marked Staffed.</li>
        <li>The primary and backups are written to the case in HubSpot.</li>
        <li>If {name.split(" ")[0]} is a backup on other cases, those are released.</li>
      </ul>
    ),
  };
}
