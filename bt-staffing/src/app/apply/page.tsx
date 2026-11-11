import type { Metadata } from "next";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "Tell us your availability · United Care ABA" };

export default function ApplyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-6">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-inverse text-[0.72rem] font-bold text-inverse-ink">UC</span>
        <span className="text-sm font-semibold text-ink">United Care ABA</span>
      </header>
      <ApplyForm />
    </main>
  );
}
