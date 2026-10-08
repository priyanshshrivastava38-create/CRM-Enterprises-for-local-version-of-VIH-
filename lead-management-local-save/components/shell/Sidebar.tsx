"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Sparkles, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarItem =
  | { kind: "tab"; label: string; icon: LucideIcon; active: boolean; onClick: () => void }
  | { kind: "link"; label: string; icon: LucideIcon; href: string; active: boolean };

export function Sidebar({ items, subtitle = "Lead Management System", workspace = "Sales & Revenue" }: { items: SidebarItem[]; subtitle?: string; workspace?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">FF</div>
          <div>
            <div className="text-sm font-semibold text-ink">FinFlow CRM</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">Finance & Sales Intelligence</div>
          </div>
        </div>
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-600 hover:bg-panel dark:text-slate-300">
          <Menu size={19} />
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <aside className="relative flex h-full w-[min(86vw,330px)] flex-col overflow-y-auto border-r border-line bg-surface p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">FF</div>
                <div><div className="text-sm font-semibold text-ink">FinFlow CRM</div><div className="text-[9px] uppercase tracking-[0.16em] text-slate-400">Finance & Sales Intelligence</div></div>
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-600 dark:text-slate-300"><X size={18} /></button>
            </div>
            <Navigation items={items} subtitle={subtitle} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-[270px] shrink-0 self-start overflow-y-auto border-r border-line bg-surface/95 p-4 lg:block">
        <div className="mb-5 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-600 to-brand-800 p-3.5 text-white shadow-soft dark:border-brand-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold ring-1 ring-white/15">FF</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">FinFlow CRM</div>
              <div className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-100">Finance & Sales Intelligence</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] font-medium text-brand-100">
            <Sparkles size={13} /> {workspace}
          </div>
        </div>
        <Navigation items={items} subtitle="Workspace" />
      </aside>
    </>
  );
}

function Navigation({ items, subtitle, onNavigate }: { items: SidebarItem[]; subtitle: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{subtitle}</div>
      <nav className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const key = item.kind === "link" ? `link:${item.href}:${item.label}` : `tab:${item.label}`;
          const className = `group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all ${item.active ? "bg-brand-600 text-white shadow-glow" : "text-slate-600 hover:bg-panel hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"}`;
          const content = <><Icon size={17} strokeWidth={item.active ? 2.3 : 1.9} /><span>{item.label}</span></>;
          if (item.kind === "link") return <Link key={key} href={item.href} onClick={onNavigate} className={className}>{content}</Link>;
          return <button key={key} onClick={() => { item.onClick(); onNavigate?.(); }} className={className}>{content}</button>;
        })}
      </nav>
    </>
  );
}
