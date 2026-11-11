"use client";

import Link from "next/link";
import { ArrowRight, Hourglass } from "lucide-react";
import { resendFormLinkAction, setMilestoneAction } from "@/app/actions";
import type { NextStep } from "@/lib/nextStep";
import { ActionButton } from "./ActionButton";
import { buttonClass } from "./button";

/** Renders the right control for a person's next step: one-click action, link, or a waiting note. */
export function NextStepButton({ personId, step, canEdit, size = "sm", primary = false }: { personId: string; step: NextStep; canEdit: boolean; size?: "sm" | "md"; primary?: boolean }) {
  const variant = primary ? "primary" : "secondary";
  if (step.key === "workday") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-3" title={step.detail}>
        <Hourglass size={13} /> {step.label}
      </span>
    );
  }
  if (step.key === "paperwork" || step.key === "profile" || step.key === "place" || !canEdit) {
    return (
      <Link href={step.key === "place" ? "/queues/place" : step.key === "paperwork" ? `/people/${personId}#paperwork` : `/people/${personId}`} className={buttonClass(variant, size)} title={step.detail}>
        {step.label} <ArrowRight size={14} />
      </Link>
    );
  }
  if (step.key === "form") {
    return <ActionButton variant={variant} size={size} title={step.detail} action={resendFormLinkAction.bind(null, personId)}>{step.label}</ActionButton>;
  }
  return <ActionButton variant={variant} size={size} title={step.detail} action={setMilestoneAction.bind(null, personId, step.key, true)}>{step.label}</ActionButton>;
}
