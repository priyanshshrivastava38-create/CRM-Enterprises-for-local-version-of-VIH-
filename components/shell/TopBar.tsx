"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { Bell, Briefcase, ChevronDown, ChevronRight, ClipboardList, FileCheck2, Plus, Search, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { locateNavItem, moduleNavForRole } from "@/components/shell/module-nav";
import { DEAL_MANAGER_ROLES } from "@/lib/rbac";
import { dateLabel } from "@/lib/format";

type Notification = { id: string; title: string; message: string; read: boolean; createdAt: string };

// Each quick-create entry is offered only when the role can see its page in the sidebar.
const CREATE_ACTIONS: { label: string; href: string; requires: string; icon: LucideIcon; dealsOnly?: boolean }[] = [
  { label: "Lead", href: "/?view=leads&create=1", requires: "/?view=leads", icon: UserPlus },
  { label: "Opportunity", href: "/opportunities?create=1", requires: "/opportunities", icon: Briefcase, dealsOnly: true },
  { label: "Price request", href: "/price-approvals?create=1", requires: "/price-approvals", icon: FileCheck2, dealsOnly: true },
  { label: "Task", href: "/?view=tasks", requires: "/?view=tasks", icon: ClipboardList }
];

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => ref.current && !ref.current.contains(event.target as Node) && close();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function TopBar({ role }: { role: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = locateNavItem(pathname, searchParams.get("view"));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const createRef = useDismiss(createOpen, () => setCreateOpen(false));
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));

  const allowed = new Set(moduleNavForRole(role).map((item) => item.href));
  const createActions = CREATE_ACTIONS.filter((action) => allowed.has(action.requires) && (!action.dealsOnly || (DEAL_MANAGER_ROLES as readonly string[]).includes(role)));
  const canSearchLeads = allowed.has("/?view=leads");

  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!json) return;
        setNotifications(json.notifications ?? []);
        setUnread(json.unread ?? 0);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="sticky top-14 z-10 print:hidden border-b border-line bg-surface/90 backdrop-blur-xl lg:top-0">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 lg:px-8">
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
          {location ? (
            <>
              <span className="text-slate-500 dark:text-slate-400">{location.section}</span>
              <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate font-medium text-ink">{location.item.label}</span>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-[280px] items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-slate-400 transition-colors hover:border-brand-300 sm:flex xl:w-[340px]"
          >
            <Search size={15} aria-hidden="true" />
            <span className="flex-1 truncate text-left">{canSearchLeads ? "Search or jump to…" : "Jump to…"}</span>
            <kbd className="rounded border border-line bg-surface px-1.5 text-[11px] font-medium text-slate-500">⌘K</kbd>
          </button>

          {createActions.length ? (
            <div ref={createRef} className="relative">
              <button
                type="button"
                onClick={() => setCreateOpen((open) => !open)}
                aria-expanded={createOpen}
                aria-haspopup="menu"
                className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <Plus size={16} aria-hidden="true" /> Create <ChevronDown size={14} aria-hidden="true" />
              </button>
              {createOpen ? (
                <div role="menu" className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-soft">
                  {createActions.map(({ label, href, icon: Icon }) => (
                    <Link key={label} role="menuitem" href={href} onClick={() => setCreateOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-panel">
                      <Icon size={15} className="text-slate-500 dark:text-slate-400" aria-hidden="true" /> {label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div ref={bellRef} className="relative">
            <button
              type="button"
              onClick={() => setBellOpen((open) => !open)}
              aria-expanded={bellOpen}
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-600 transition-colors hover:bg-panel dark:text-slate-300"
            >
              <Bell size={16} aria-hidden="true" />
              {unread ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span> : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
                <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Notifications</div>
                {notifications.length ? (
                  <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {!notification.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" /> : null}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink">{notification.title}</div>
                            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{notification.message}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{dateLabel(notification.createdAt)}</div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">You&apos;re all caught up.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <CommandPalette role={role} open={paletteOpen} onOpenChange={setPaletteOpen} createActions={createActions} canSearchLeads={canSearchLeads} />
    </div>
  );
}
