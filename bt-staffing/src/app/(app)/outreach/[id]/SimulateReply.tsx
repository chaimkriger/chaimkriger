"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { simulateReplyAction } from "@/app/actions";
import { toast } from "@/components/toast";

export function SimulateReply({ recipientId, hasReply }: { recipientId: string; hasReply: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const send = (body: string) => {
    start(async () => {
      const r = await simulateReplyAction(recipientId, body);
      if (r.ok) setText("");
      else toast("error", r.error ?? "Could not log reply");
      router.refresh();
    });
  };
  const quick = "h-8 rounded-[10px] border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-raised disabled:opacity-50";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong bg-raised px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3"><FlaskConical size={13} /> Simulate {hasReply ? "another " : "a "}reply</span>
      <button type="button" disabled={pending} className={quick} onClick={() => send("YES")}>YES</button>
      <button type="button" disabled={pending} className={quick} onClick={() => send("NO")}>NO</button>
      <form
        className="flex flex-1 gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input aria-label="Custom reply text" value={text} onChange={(e) => setText(e.target.value)} placeholder="or type a reply" className="field !h-8 min-w-32 flex-1 !py-1 !text-xs" />
        <button disabled={pending || !text.trim()} className={quick}>Log reply</button>
      </form>
    </div>
  );
}
