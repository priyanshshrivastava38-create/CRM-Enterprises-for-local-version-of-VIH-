"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    setLoading(false);
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? `Sign-in failed (${response.status}). Check the database configuration.`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  function quickLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <main className="min-h-screen bg-app-glow px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_420px]">
        <section className="hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Finance & Sales Intelligence Platform
          </div>
          <div className="mb-7 inline-flex items-center gap-3 text-2xl font-semibold text-ink"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-glow">FF</span> FinFlow CRM</div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-ink">Finance &amp; Sales Intelligence Platform</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">One connected revenue lifecycle for prospects, opportunities, customer onboarding, invoicing, payments, and collections.</p>

          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              ["Pipeline", "Lead 360"],
              ["Automation", "SLA & AI"],
              ["Operations", "Finance & billing"]
            ].map(([title, subtitle]) => (
              <div key={title} className="rounded-2xl border border-line bg-surface/80 p-4 shadow-card backdrop-blur">
                <div className="text-sm font-semibold text-ink">{title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">Sign in to your workspace</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choose a seeded role or enter your credentials.</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow"><LockKeyhole size={18} /></div>
          </div>

          <div className="mt-6 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button key={account.email} type="button" onClick={() => quickLogin(account)} className="flex items-center justify-between rounded-xl border border-line bg-panel px-3 py-2.5 text-left text-sm transition-all hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10">
                <span className="font-medium text-ink">Login as {account.roleLabel}</span>
                <span className="text-xs text-slate-500">{account.email}</span>
              </button>
            ))}
          </div>

          <label className="mt-6 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email address</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-[#f8fafd] px-3 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 dark:bg-[#101b2d]">
            <Mail size={16} className="text-slate-400" />
            <select value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 flex-1 bg-transparent text-sm text-ink outline-none">
              {DEMO_ACCOUNTS.map((account) => <option key={account.email} value={account.email}>{account.email}</option>)}
            </select>
          </div>

          <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-[#f8fafd] px-3 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 dark:bg-[#101b2d]">
            <LockKeyhole size={16} className="text-slate-400" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="h-11 flex-1 bg-transparent text-sm text-ink outline-none" />
          </div>

          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">{error}</p> : null}
          <button disabled={loading} className="mt-6 h-11 w-full rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">Demo-only credentials for local testing. Never use these in production.</p>
        </form>
      </div>
    </main>
  );
}
