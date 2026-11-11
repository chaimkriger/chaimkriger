import { Check } from "lucide-react";

export default function Thanks() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 animate-up items-center justify-center rounded-full bg-ready text-white"><Check size={32} strokeWidth={3} /></div>
      <h1 className="mt-6 text-2xl font-semibold tracking-[-0.02em] text-ink">Thank you!</h1>
      <p className="mt-2 max-w-xs text-[0.95rem] leading-relaxed text-ink-2">
        We have your details. A United Care ABA recruiter will reach out to you soon. You can close this page.
      </p>
    </main>
  );
}
