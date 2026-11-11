import type { Metadata } from "next";
import { ApplyForm } from "./ApplyForm";

export const metadata: Metadata = { title: "United Care ABA - Tell us your availability" };

export default function ApplyPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">United Care ABA</h1>
      <p className="mt-1 text-sm text-slate-600">
        Thanks for applying! This takes about 2 minutes and helps us match you to a case near you.
      </p>
      <ApplyForm />
    </main>
  );
}
