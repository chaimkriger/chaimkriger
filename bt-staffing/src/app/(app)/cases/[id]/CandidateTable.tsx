"use client";

import Link from "next/link";
import { useState } from "react";
import { addBackupAction, assignPrimaryAction, sendOutreachAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Badge, CertBadge, KindBadge, ReadyBadge, SlotGrid } from "@/components/ui";
import type { MatchBreakdown } from "@/lib/matching";

export interface CandidateView {
  id: string;
  name: string;
  kind: "APPLICANT" | "STAFF";
  ready: boolean;
  certification: string;
  openSlots: string[];
  attachedAs: "PRIMARY" | "BACKUP" | null;
  breakdown: MatchBreakdown;
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2" title={`${label}: ${value} of ${max}`}>
      <div className="h-1.5 w-16 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.round((value / max) * 100)}%` }} />
      </div>
      <span className="w-12 text-xs tabular-nums text-slate-600">{value}/{max}</span>
    </div>
  );
}

export function CandidateTable({
  caseId, caseCode, caseSlots, candidates, canPlace, canOutreach, hasPrimary, backupsFull, defaultMessage,
}: {
  caseId: string;
  caseCode: string;
  caseSlots: string[];
  candidates: CandidateView[];
  canPlace: boolean;
  canOutreach: boolean;
  hasPrimary: boolean;
  backupsFull: boolean;
  defaultMessage: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState(defaultMessage);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (!candidates.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No candidates match this case yet. Try including people who are not ready, then chase them.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              {canOutreach && <th className="px-2 py-2">Text</th>}
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Candidate</th>
              <th className="px-2 py-2">Score</th>
              <th className="px-2 py-2">Drive time</th>
              <th className="px-2 py-2">Hours covered</th>
              <th className="px-2 py-2">Requirements</th>
              {canPlace && <th className="px-2 py-2">Place by hand</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((c, i) => {
              const b = c.breakdown;
              return (
                <tr key={c.id} className={c.attachedAs ? "bg-violet-50/50" : undefined}>
                  {canOutreach && (
                    <td className="px-2 py-2 align-top">
                      <input type="checkbox" aria-label={`Select ${c.name} for outreach`} checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
                    </td>
                  )}
                  <td className="px-2 py-2 align-top tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-2 py-2 align-top">
                    <Link href={`/people/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <KindBadge kind={c.kind} />
                      <ReadyBadge ready={c.ready} />
                      <CertBadge certification={c.certification} kind={c.kind} />
                      {c.attachedAs === "BACKUP" && <Badge tone="violet">Backup on this case</Badge>}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="inline-block rounded bg-slate-800 px-2 py-0.5 text-sm font-semibold tabular-nums text-white">{b.total}</span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="whitespace-nowrap text-sm tabular-nums">{b.driveMinutes} min <span className="text-xs text-slate-500">(max {b.maxTravelMinutes})</span></div>
                    <Bar value={b.driveScore} max={40} label="Drive score" />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-2">
                      <SlotGrid compact slots={[]} highlight={b.overlapSlots} muted={caseSlots.filter((s) => !b.overlapSlots.includes(s))} />
                      <div>
                        <div className="whitespace-nowrap text-sm tabular-nums">{b.overlapSlots.length} of {b.caseSlotCount}</div>
                        <Bar value={b.availabilityScore} max={40} label="Availability score" />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <Bar value={b.requirementsScore} max={20} label="Requirements score" />
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {b.requirements.length === 0 && <li className="text-slate-500">No special requirements</li>}
                      {b.requirements.map((r) => (
                        <li key={r.label} className={r.credit === 1 ? "text-green-800" : r.credit === 0 ? "text-red-800" : "text-amber-800"}>
                          {r.credit === 1 ? "✓" : r.credit === 0 ? "✗" : "?"} {r.label}: {r.detail}
                        </li>
                      ))}
                    </ul>
                  </td>
                  {canPlace && (
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <ActionButton
                          variant="primary"
                          disabled={hasPrimary || !c.ready}
                          title={!c.ready ? "Not ready: finish their missing items first" : hasPrimary ? "Case already has a primary" : undefined}
                          confirm={`Place ${c.name} as primary on ${caseCode}?`}
                          action={assignPrimaryAction.bind(null, caseId, c.id)}
                        >
                          Place as primary
                        </ActionButton>
                        <ActionButton
                          disabled={!!c.attachedAs || backupsFull}
                          title={c.attachedAs ? "Already attached" : backupsFull ? "Backups are full" : undefined}
                          action={addBackupAction.bind(null, caseId, c.id)}
                        >
                          Add as backup
                        </ActionButton>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canOutreach && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-900">Text the shortlist ({selected.length} selected)</div>
          <p className="text-xs text-slate-500">Tick people above, then send. Replies are logged; the first yes is proposed as primary and later ones as backups, for you to confirm.</p>
          <textarea
            aria-label="Outreach message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={480}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2">
            <ActionButton variant="primary" size="md" disabled={selected.length === 0} action={() => sendOutreachAction(caseId, selected, message)}>
              Send text to {selected.length || "selected"} {selected.length === 1 ? "person" : "people"}
            </ActionButton>
          </div>
        </div>
      )}
    </>
  );
}
