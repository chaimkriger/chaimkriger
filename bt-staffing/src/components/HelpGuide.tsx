"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Dialog } from "./Dialog";
import { Badge, ScoreBar } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[0.95rem] font-semibold text-ink">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** "How it works": the whole app in plain words, one click from every screen. */
export function HelpGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.83rem] font-medium text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <CircleHelp size={17} />
        <span className="hidden sm:inline">How it works</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} side title="How it works">
        <div className="space-y-7 pb-4">
          <Section title="The goal">
            <p>Cases are waiting for a BT. This app shows who can take each one, and what is holding everyone else up.</p>
          </Section>

          <Section title="The colours mean the same thing everywhere">
            <ul className="space-y-2">
              <li className="flex items-center gap-2.5"><span className="pin pin-ready shrink-0"><span>✓</span></span><span><strong className="text-ink">Green: ready.</strong> Nothing missing. Can be placed today.</span></li>
              <li className="flex items-center gap-2.5"><span className="pin pin-notready shrink-0"><span>!</span></span><span><strong className="text-ink">Red: not ready.</strong> Something is still missing.</span></li>
              <li className="flex items-center gap-2.5"><span className="pin pin-staff shrink-0"><span>S</span></span><span><strong className="text-ink">Blue: current staff</strong> who have free hours.</span></li>
              <li className="flex items-center gap-2.5"><span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center"><span className="pin pin-case" style={{ transform: "rotate(45deg) scale(0.75)" }}><span>C</span></span></span><span><strong className="text-ink">Amber diamond: a case</strong> that needs a BT.</span></li>
              <li className="flex items-center gap-2.5"><span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center"><span className="pin pin-case pin-restaffing" style={{ transform: "rotate(45deg) scale(0.75)" }}><span>R</span></span></span><span><strong className="text-ink">Purple diamond: restaffing.</strong> The case lost its BT and needs a new one.</span></li>
            </ul>
          </Section>

          <Section title="Three lists, three jobs">
            <p><strong className="text-ink">Chase</strong>: people who cannot work yet. Each row says how many steps are left and has a button for the next one.</p>
            <p><strong className="text-ink">Place</strong>: people who are ready, with the cases they fit best.</p>
            <p><strong className="text-ink">Open cases</strong>: cases waiting for a BT, longest wait first.</p>
          </Section>

          <Section title="What makes someone ready">
            <p>They filled in our form, were screened, got the application and the in-service trainings, handed in all the paperwork, and Workday shows them as hired. Until then the app lists exactly what is missing.</p>
          </Section>

          <Section title="The match score">
            <p>For each case, everyone who could take it gets a score out of 100. Higher is better. It adds up three things:</p>
            <div className="rounded-xl bg-raised p-3">
              <ScoreBar drive={30} availability={40} requirements={10} showLegend />
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong className="text-ink">Drive</strong>: how close they live to the case.</li>
              <li><strong className="text-ink">Hours</strong>: how many of the case&apos;s time slots they can cover.</li>
              <li><strong className="text-ink">Fit</strong>: whether they meet the case&apos;s requirements (RBT, language, age group).</li>
            </ul>
            <p className="flex flex-wrap items-center gap-1.5">In words: <Badge>80+ Great match</Badge> <Badge>60+ Good match</Badge> <Badge>40+ Fair match</Badge> <Badge>under 40 Weak match</Badge></p>
            <p>Someone who lives further away than they said they would travel, or who has no hours in common with the case, is not shown at all.</p>
          </Section>

          <Section title="Primary and backups">
            <p>Each case has one <strong className="text-ink">primary</strong> BT and up to four <strong className="text-ink">backups</strong>. A backup stays attached for 30 days, unless they are placed on another case. If a case loses its BT, its backups are offered first.</p>
          </Section>

          <Section title="You decide">
            <p>The app only suggests. Nobody is placed on a case until a recruiter presses <strong className="text-ink">Place as primary</strong> and confirms.</p>
          </Section>
        </div>
      </Dialog>
    </>
  );
}
