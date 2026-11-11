"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Car, Check, Footprints, HelpCircle, MessageSquareText, Phone, X } from "lucide-react";
import { addBackupAction, assignPrimaryAction, sendOutreachAction } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { buttonClass } from "@/components/button";
import { placeConfirm } from "@/components/confirms";
import { Dialog } from "@/components/Dialog";
import { Avatar, Badge, CertBadge, cx, KindBadge, MatchWord, MissingList, personTone, ReadyBadge, Ring, ScoreBar, SlotGrid } from "@/components/ui";
import { fitSummary, type MatchBreakdown, matchSentence } from "@/lib/matching";
import { MiniMap, type MiniPin } from "./MiniMap";

export interface CandidateView {
  id: string;
  name: string;
  kind: "APPLICANT" | "STAFF";
  ready: boolean;
  certification: string;
  openSlots: string[];
  attachedAs: "PRIMARY" | "BACKUP" | null;
  breakdown: MatchBreakdown;
  lat: number;
  lng: number;
  city: string | null;
  mobile: string;
  hasCar: boolean;
  languages: string[];
  missing: string[];
}

function ReqIcon({ credit }: { credit: number }) {
  if (credit === 1) return <Check size={13} className="text-ready" />;
  if (credit === 0) return <X size={13} className="text-notready" />;
  return <HelpCircle size={13} className="text-case-ink" />;
}

const PAGE = 12;

export function Workspace({
  caseId, caseCode, caseSlots, center, restaffing, candidates, canPlace, canOutreach, hasPrimary, backupsFull, defaultMessage, focusId, rail,
}: {
  caseId: string;
  caseCode: string;
  caseSlots: string[];
  center: { lat: number; lng: number } | null;
  restaffing: boolean;
  candidates: CandidateView[];
  canPlace: boolean;
  canOutreach: boolean;
  hasPrimary: boolean;
  backupsFull: boolean;
  defaultMessage: string;
  focusId: string | null;
  /** Server-rendered cards shown under the map. */
  rail: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(focusId && candidates.some((c) => c.id === focusId) ? focusId : null);
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  // Start with the strongest matches; the rest are one click away.
  const [showAll, setShowAll] = useState(false);
  const focusIndex = focusId ? candidates.findIndex((c) => c.id === focusId) : -1;
  const limit = showAll ? candidates.length : Math.max(PAGE, focusIndex + 1);
  const shown = useMemo(() => candidates.slice(0, limit), [candidates, limit]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const open = candidates.find((c) => c.id === openId) ?? null;
  const rankOf = (id: string) => candidates.findIndex((c) => c.id === id) + 1;

  // Drop selections that are no longer in the list (after a refresh).
  useEffect(() => setSelected((s) => s.filter((id) => candidates.some((c) => c.id === id))), [candidates]);

  const pins: MiniPin[] = useMemo(
    () => shown.slice(0, 25).map((c, i) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, tone: personTone(c.kind, c.ready) as MiniPin["tone"], rank: i + 1 })),
    [shown],
  );
  const selectedPeople = candidates.filter((c) => selected.includes(c.id));

  const actions = (c: CandidateView, size: "sm" | "md", emphasis = true) =>
    canPlace && (
      <>
        <ActionButton
          variant={emphasis ? "primary" : "secondary"} size={size}
          disabled={hasPrimary || !c.ready}
          title={!c.ready ? "Not ready: finish their missing items first" : hasPrimary ? "Case already has a primary" : undefined}
          confirm={placeConfirm(c.name, caseCode)}
          action={assignPrimaryAction.bind(null, caseId, c.id)}
          onDone={(r) => r.ok && setOpenId(null)}
        >
          Place as primary
        </ActionButton>
        <ActionButton
          size={size}
          disabled={!!c.attachedAs || backupsFull}
          title={c.attachedAs ? "Already attached to this case" : backupsFull ? "Backups are full (4 of 4)" : undefined}
          action={addBackupAction.bind(null, caseId, c.id)}
        >
          Add as backup
        </ActionButton>
      </>
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0">
        {candidates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-2">
            Nobody ready can take this case yet. Switch to &quot;Include not ready&quot; to see who is close, then chase them.
          </p>
        ) : (
          <ol className="space-y-2">
            {shown.map((c, i) => {
              const b = c.breakdown;
              const isSelected = selected.includes(c.id);
              return (
                <li
                  key={c.id}
                  data-candidate={c.id}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  className={cx(
                    "group grid items-center gap-x-4 gap-y-3 rounded-2xl border bg-surface px-3.5 py-3 shadow-card transition md:grid-cols-[auto_minmax(0,1fr)_minmax(0,17rem)_auto]",
                    isSelected ? "border-ink" : c.attachedAs ? "border-restaff/50" : "border-line hover:border-line-strong",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {canOutreach && (
                      <input type="checkbox" aria-label={`Select ${c.name} for outreach`} checked={isSelected} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--ink)]" />
                    )}
                    <span className="num w-5 text-center text-sm font-medium text-ink-3">{i + 1}</span>
                  </div>
                  <button type="button" onClick={() => setOpenId(c.id)} className="flex min-w-0 items-center gap-3 rounded-xl text-left" aria-label={`Open details for ${c.name}`}>
                    <Avatar name={c.name} tone={personTone(c.kind, c.ready)} size={38} />
                    <span className="min-w-0">
                      <span className="block text-[0.95rem] font-medium leading-tight text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4">{c.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <KindBadge kind={c.kind} />
                        {!c.ready && <ReadyBadge ready={false} />}
                        <CertBadge certification={c.certification} kind={c.kind} />
                        {c.attachedAs === "BACKUP" && <Badge tone="restaff">Backup on this case</Badge>}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-3">
                    <Ring value={b.total} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[0.8rem]"><MatchWord total={b.total} /></div>
                      <ScoreBar drive={b.driveScore} availability={b.availabilityScore} requirements={b.requirementsScore} />
                      <div className="mt-1.5 text-[0.72rem] leading-snug text-ink-2">
                        {matchSentence(b)}
                        <span className={cx("block", fitSummary(b.requirements).ok ? "" : fitSummary(b.requirements).text.startsWith("Missing") ? "text-notready-ink" : "text-case-ink")}>{fitSummary(b.requirements).text}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:justify-end">{actions(c, "sm", i === 0)}</div>
                </li>
              );
            })}
          </ol>
        )}
        {candidates.length > shown.length && (
          <button type="button" onClick={() => setShowAll(true)} className={buttonClass("secondary", "md", "mt-3 w-full")}>
            Show {candidates.length - shown.length} more people
          </button>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        {center && (
          <div className="rounded-2xl border border-line bg-surface p-2 shadow-card">
            <MiniMap center={center} restaffing={restaffing} pins={pins} activeId={openId ?? hovered} onPick={setOpenId} />
            <p className="px-2 pb-1 pt-2 text-xs text-ink-3">The diamond is the case. Numbers match the list: 1 is the best match. Point at a row to find that person; click a pin for details.</p>
          </div>
        )}
        {rail}
      </aside>

      {/* Floating outreach bar */}
      {canOutreach && selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-[950] flex justify-center px-4 md:bottom-6">
          <div className="flex animate-up items-center gap-3 rounded-2xl bg-inverse py-2 pl-4 pr-2 text-sm text-inverse-ink shadow-pop">
            <span><span className="num font-semibold">{selected.length}</span> selected</span>
            <button type="button" onClick={() => setSelected([])} className="rounded-lg px-2 py-1 text-inverse-ink/70 hover:text-inverse-ink">Clear</button>
            <button type="button" onClick={() => setComposing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-inverse-ink px-3.5 font-medium text-inverse">
              <MessageSquareText size={15} /> Text shortlist
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={composing}
        onClose={() => setComposing(false)}
        wide
        title={`Text ${selected.length} ${selected.length === 1 ? "person" : "people"} about ${caseCode}`}
        footer={
          <>
            <button type="button" className={buttonClass("secondary", "md")} onClick={() => setComposing(false)}>Cancel</button>
            <ActionButton variant="primary" size="md" disabled={!message.trim()} action={() => sendOutreachAction(caseId, selected, message)}>
              Send text to {selected.length} {selected.length === 1 ? "person" : "people"}
            </ActionButton>
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedPeople.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-sunken py-1 pl-1 pr-2.5 text-xs font-medium text-ink">
              <Avatar name={p.name} tone={personTone(p.kind, p.ready)} size={20} /> {p.name}
            </span>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-ink">
          Message
          <textarea aria-label="Outreach message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={480} className="field mt-1.5" />
        </label>
        <div className="mt-1 flex justify-between text-xs text-ink-3">
          <span>Replies are logged. First yes is proposed as primary, later ones as backups, for you to confirm.</span>
          <span className="num">{message.length}/480</span>
        </div>
      </Dialog>

      {/* Candidate detail drawer */}
      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        side
        title={open ? <span className="flex items-center gap-3"><Avatar name={open.name} tone={personTone(open.kind, open.ready)} size={40} /><span>{open.name}<span className="block text-xs font-normal text-ink-3">Rank #{rankOf(open.id)} for {caseCode}</span></span></span> : ""}
        footer={open ? <>{actions(open, "md")}<Link href={`/people/${open.id}`} className={buttonClass("ghost", "md")}>Full profile <ArrowUpRight size={15} /></Link></> : undefined}
      >
        {open && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-1.5">
              <KindBadge kind={open.kind} />
              <ReadyBadge ready={open.ready} />
              <CertBadge certification={open.certification} kind={open.kind} />
              {open.attachedAs === "BACKUP" && <Badge tone="restaff">Backup on this case</Badge>}
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-raised p-4">
              <Ring value={open.breakdown.total} size={64} stroke={5} />
              <div className="min-w-0 flex-1">
                <div className="mb-2 text-sm text-ink"><MatchWord total={open.breakdown.total} /> <span className="text-ink-3">· match score {open.breakdown.total} out of 100</span></div>
                <ScoreBar drive={open.breakdown.driveScore} availability={open.breakdown.availabilityScore} requirements={open.breakdown.requirementsScore} showLegend />
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Drive time</h3>
              <p className="flex items-center gap-2 text-sm text-ink">
                {open.hasCar ? <Car size={16} className="text-ink-3" /> : <Footprints size={16} className="text-ink-3" />}
                <span><strong className="num">{open.breakdown.driveMinutes} min</strong> {open.hasCar ? "by car" : "without a car"} from {open.city ?? "home"}; their limit is {open.breakdown.maxTravelMinutes} min.</span>
              </p>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Hours: can cover {open.breakdown.overlapSlots.length} of {open.breakdown.caseSlotCount} time slots</h3>
              <SlotGrid slots={[]} highlight={open.breakdown.overlapSlots} muted={caseSlots.filter((s) => !open.breakdown.overlapSlots.includes(s))} />
              <p className="mt-1.5 text-xs text-ink-3">Green = case hours this person can cover. Hatched = case hours they cannot.</p>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Requirements: {fitSummary(open.breakdown.requirements).text}</h3>
              {open.breakdown.requirements.length === 0 ? (
                <p className="text-sm text-ink-2">This case has no special requirements.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {open.breakdown.requirements.map((r) => (
                    <li key={r.label} className="flex items-center gap-2">
                      <ReqIcon credit={r.credit} />
                      <span className="text-ink">{r.label}</span>
                      <span className="text-ink-3">{r.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!open.ready && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.07em] text-ink-3">Missing before they can be placed</h3>
                <MissingList missing={open.missing} max={12} />
              </section>
            )}

            <section className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
              {open.mobile && <span className="inline-flex items-center gap-1.5"><Phone size={14} /> <span className="num">{open.mobile}</span></span>}
              {open.languages.length > 0 && <span>{open.languages.join(", ")}</span>}
            </section>
          </div>
        )}
      </Dialog>
    </div>
  );
}

