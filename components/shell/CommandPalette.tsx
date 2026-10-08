"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CornerDownLeft, LogOut, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { moduleNavSectionsForRole } from "@/components/shell/module-nav";

export type PaletteAction = { label: string; href: string; icon: LucideIcon };

type Command = { id: string; group: string; label: string; icon: LucideIcon; run: () => void };

/** ⌘K / Ctrl+K launcher: jump to any page, start a create flow, or search leads. */
export function CommandPalette({ role, open, onOpenChange, createActions, canSearchLeads }: { role: string; open: boolean; onOpenChange: (open: boolean) => void; createActions: PaletteAction[]; canSearchLeads: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo(() => {
    const go = (href: string) => () => {
      onOpenChange(false);
      router.push(href);
    };
    const list: Command[] = [];
    const term = query.trim();
    if (term && canSearchLeads) {
      list.push({ id: "search", group: "Search", label: `Search leads for “${term}”`, icon: Search, run: go(`/?view=leads&q=${encodeURIComponent(term)}`) });
    }
    for (const action of createActions) list.push({ id: `create:${action.label}`, group: "Create", label: `New ${action.label.toLowerCase()}`, icon: action.icon, run: go(action.href) });
    for (const section of moduleNavSectionsForRole(role)) {
      for (const item of section.items) list.push({ id: `nav:${item.href}`, group: "Go to", label: `${item.label}`, icon: item.icon, run: go(item.href) });
    }
    list.push({
      id: "signout",
      group: "Account",
      label: "Sign out",
      icon: LogOut,
      run: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }
    });
    const needle = term.toLowerCase();
    return needle ? list.filter((command) => command.id === "search" || command.label.toLowerCase().includes(needle)) : list;
  }, [canSearchLeads, createActions, onOpenChange, query, role, router]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      commands[cursor]?.run();
    } else if (event.key === "Escape") {
      onOpenChange(false);
    }
  }

  let lastGroup = "";
  // Portalled to <body>: the top bar's backdrop blur would otherwise become the overlay's containing block.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-sm print:hidden" onMouseDown={() => onOpenChange(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command menu" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={canSearchLeads ? "Search leads, jump to a page, or create…" : "Jump to a page or create…"}
            aria-label="Command"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length ? (
            commands.map((command, index) => {
              const header = command.group !== lastGroup ? command.group : null;
              lastGroup = command.group;
              const Icon = command.icon;
              return (
                <li key={command.id}>
                  {header ? <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 first:pt-1">{header}</div> : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === cursor}
                    onMouseEnter={() => setCursor(index)}
                    onClick={command.run}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${index === cursor ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "text-ink"}`}
                  >
                    <Icon size={16} className={index === cursor ? "" : "text-slate-400"} aria-hidden="true" />
                    <span className="flex-1 truncate">{command.label}</span>
                    {index === cursor ? <CornerDownLeft size={14} className="text-slate-400" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No matches.</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
