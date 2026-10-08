"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Workflow } from "lucide-react";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

// Demo shortcuts are only offered in local development; production shows a plain sign-in form.
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production";

const HIGHLIGHTS = [
  { icon: Workflow, title: "Unified pipeline", text: "Lead intake, qualification, and opportunities in one place." },
  { icon: BarChart3, title: "Real-time insight", text: "Role-based dashboards for sales, finance, and leadership." },
  { icon: ShieldCheck, title: "Secure by design", text: "Role-based access control and audited approvals." }
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function performLogin(targetEmail: string, targetPassword: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword })
      });
      if (!response.ok) {
        setLoading(false);
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? "Unable to sign in. Please try again.");
        return;
      }
      const result = (await response.json().catch(() => null)) as { redirectTo?: string } | null;
      window.location.href = result?.redirectTo ?? "/";
    } catch {
      setLoading(false);
      setError("Unable to reach the server. Check your connection and try again.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    await performLogin(email, password);
  }

  function quickLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    void performLogin(account.email, account.password);
  }

  return (
    <main className="grid min-h-screen bg-appbg lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-400/15 blur-3xl" />

        <img src="/logo-dark.png" alt="ViH Metaverse" className="relative h-12 w-auto self-start" />

        <div className="relative max-w-xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.04em] xl:text-5xl">Lead intelligence for modern revenue teams.</h1>
          <p className="mt-5 text-base leading-7 text-brand-100/80">
            A single workspace for lead intake, pipeline management, customer onboarding, billing, and commercial approvals.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon size={18} />
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-0.5 text-sm text-brand-100/70">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-100/60">© {new Date().getFullYear()} ViH Metaverse. All rights reserved.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <img src="/logo-light.png" alt="ViH Metaverse" className="mb-10 h-10 w-auto lg:hidden dark:hidden" />
          <img src="/logo-dark.png" alt="ViH Metaverse" className="mb-10 hidden h-10 w-auto dark:block lg:!hidden" />

          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-ink">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use your ViH Metaverse work account to continue.</p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Work email</label>
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
                <Mail size={16} className="text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
                <LockKeyhole size={16} className="text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
              {loading ? null : <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Trouble signing in? Contact your workspace administrator.
          </p>

          {SHOW_DEMO_ACCOUNTS ? (
            <div className="mt-10 rounded-2xl border border-dashed border-line p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Development · demo accounts</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={loading}
                    onClick={() => quickLogin(account)}
                    title={account.email}
                    className="rounded-lg border border-line bg-panel px-3 py-2 text-left text-xs font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60 dark:hover:bg-brand-500/10"
                  >
                    {account.roleLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
