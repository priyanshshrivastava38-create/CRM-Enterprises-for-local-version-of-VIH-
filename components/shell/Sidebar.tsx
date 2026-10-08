"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ui";
import { isNavItemActive, moduleNavSectionsForRole, roleLabel } from "@/components/shell/module-nav";

export type ShellUser = { id: string; name: string; email: string; role: string };

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="ViH Metaverse CRM home">
      <img src="/logo-light.png" alt="ViH Metaverse" className="h-8 w-auto dark:hidden" />
      <img src="/logo-dark.png" alt="ViH Metaverse" className="hidden h-8 w-auto dark:block" />
      <span className="border-l border-line pl-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">CRM</span>
    </Link>
  );
}

export function Sidebar({ user }: { user: ShellUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 print:hidden items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-600 hover:bg-panel dark:text-slate-300">
          <Menu size={19} />
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <aside className="relative flex h-full w-[min(86vw,300px)] flex-col border-r border-line bg-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Brand />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-600 dark:text-slate-300"><X size={18} /></button>
            </div>
            <SidebarBody user={user} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex print:!hidden">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-4">
          <Brand />
        </div>
        <SidebarBody user={user} />
      </aside>
    </>
  );
}

function SidebarBody({ user, onNavigate }: { user: ShellUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const sections = moduleNavSectionsForRole(user.role);
  const unreadMessages = useUnreadMessages();

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{section.title}</div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item, pathname, view);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                          : "text-slate-600 hover:bg-panel hover:text-ink dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "" : "text-slate-400 dark:text-slate-500"} />
                      <span className="truncate">{item.label}</span>
                      {item.href === "/messages" && unreadMessages ? (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white" aria-label={`${unreadMessages} unread`}>
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-line p-3">
        <ThemeToggle compact />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{user.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel(user.role)}</div>
          </div>
          <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-panel hover:text-ink dark:text-slate-400">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

const UNREAD_POLL_MS = 15000;

/** Total unread team and direct messages, refreshed in the background for the sidebar badge. */
function useUnreadMessages() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/messages/unread").catch(() => null);
      if (!response?.ok || cancelled) return;
      setTotal(((await response.json()) as { total: number }).total);
    }
    void load();
    const timer = setInterval(load, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return total;
}
