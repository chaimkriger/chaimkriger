"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulateReplyAction } from "@/app/actions";

export function SimulateReply({ recipientId, hasReply }: { recipientId: string; hasReply: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = (body: string) => {
    setError(null);
    start(async () => {
      const r = await simulateReplyAction(recipientId, body);
      if (r.ok) setText("");
      else setError(r.error ?? "Could not log reply");
      router.refresh();
    });
  };
  const quick = "rounded-md bg-white px-2.5 py-1 text-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3">
      <span className="text-xs font-medium text-slate-500">Simulate {hasReply ? "another " : "a "}reply:</span>
      <button type="button" disabled={pending} className={quick} onClick={() => send("YES")}>YES</button>
      <button type="button" disabled={pending} className={quick} onClick={() => send("NO")}>NO</button>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input aria-label="Custom reply text" value={text} onChange={(e) => setText(e.target.value)} placeholder="or type a reply" className="w-44 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <button disabled={pending || !text.trim()} className={quick}>Log reply</button>
      </form>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
