import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

// Shown only when SHOW_DEMO_LOGINS is not "false". These are the seeded demo accounts.
const DEMO = [
  { label: "Recruiter", email: "recruiter@example.com", password: "Recruiter123!" },
  { label: "Offshore recruiter", email: "offshore@example.com", password: "Offshore123!" },
  { label: "Admin", email: "admin@example.com", password: "Admin123!" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/today");
  const { next } = await searchParams;
  const showDemo = (process.env.SHOW_DEMO_LOGINS ?? "true") !== "false";
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-inverse p-12 text-inverse-ink lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-inverse-ink text-[0.75rem] font-bold text-inverse">UC</span>
          <span className="text-sm font-semibold">United Care ABA</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em]">From applied to placed, without the wait.</h1>
          <ul className="mt-8 space-y-3.5 text-[0.95rem] text-inverse-ink/80">
            {[
              "See who is closest to ready, and what one thing is missing.",
              "Rank every ready BT for a case by drive time, hours and fit.",
              "You make every placement. The system only ranks.",
            ].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ready" />{t}</li>
            ))}
          </ul>
        </div>
        {/* The map language, as a quiet decoration */}
        <div aria-hidden="true" className="flex items-center gap-3 text-xs text-inverse-ink/60">
          <span className="pin pin-ready"><span>✓</span></span> Ready
          <span className="pin pin-notready"><span>!</span></span> Not ready
          <span className="pin pin-staff"><span>S</span></span> Staff
          <span className="ml-1 flex h-5 w-5 items-center justify-center"><span className="pin pin-case" style={{ transform: "rotate(45deg) scale(0.75)" }}><span>C</span></span></span> Case
        </div>
      </section>

      <section className="flex flex-col p-6">
        <div className="flex justify-end"><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
          <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-inverse text-[0.8rem] font-bold text-inverse-ink lg:hidden">UC</span>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Sign in to BT Staffing</h2>
          <p className="mt-1.5 text-sm text-ink-2">Recruiters, offshore recruiters and admins.</p>
          <LoginForm next={next ?? ""} demo={showDemo ? DEMO : []} />
        </div>
      </section>
    </main>
  );
}
