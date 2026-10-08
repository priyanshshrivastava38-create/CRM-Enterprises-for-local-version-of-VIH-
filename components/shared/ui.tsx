"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { titleCase } from "@/lib/format";

export const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-all duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

export const primaryBtnClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";

export const secondaryBtnClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-panel active:translate-y-0";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Default padding keeps content inside the card border; callers can still override (e.g. "p-0" for edge-to-edge tables).
  return <section className={twMerge("rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
    violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-500/10 dark:text-violet-400",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>{typeof children === "string" ? <span className="inline-block lowercase first-letter:uppercase">{children}</span> : children}</span>;
}

export function Title({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <input
        required={required}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 ${fieldClass}`}
      />
    </label>
  );
}

export function Textarea({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className={`py-2 ${fieldClass}`} />
    </label>
  );
}

export type SelectOption = string | { value: string; label: string; disabled?: boolean };

export function Select({
  label,
  value,
  onChange,
  options,
  render,
  loading = false,
  placeholder = "Select an option",
  emptyLabel = "No options available"
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  render?: (option: string) => string;
  loading?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => {
        if (typeof option === "string") {
          return { value: option, label: render ? render(option) : titleCase(option), disabled: false };
        }

        return {
          value: option.value,
          label: option.label,
          disabled: !!option.disabled
        };
      }),
    [options, render]
  );

  const hasOptions = normalizedOptions.length > 0;
  const selectedOption = normalizedOptions.find((option) => option.value === (value ?? "")) ?? null;

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [normalizedOptions, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayText = loading
    ? "Loading options..."
    : selectedOption
      ? selectedOption.label
      : placeholder;

  return (
    <div className="block" ref={wrapperRef}>
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => {
            if (loading || !hasOptions) return;
            setOpen((current) => !current);
          }}
          disabled={loading || !hasOptions}
          className={`flex h-10 w-full items-center justify-between rounded-lg border border-line bg-surface px-3 text-left text-sm transition-all duration-150 ${fieldClass} ${loading || !hasOptions ? "cursor-not-allowed opacity-75" : "hover:border-brand-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"}`}
        >
          <span className={selectedOption ? "text-ink" : "text-slate-500 dark:text-slate-400"}>{displayText}</span>
          <span className="text-slate-500 dark:text-slate-400">{open ? "▴" : "▾"}</span>
        </button>

        {open && !loading && hasOptions ? (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line bg-white shadow-soft dark:bg-slate-900">
            <div className="border-b border-line bg-slate-50/80 p-2 dark:bg-slate-950/60">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search options..."
                className="h-9 w-full rounded-lg border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:bg-slate-900"
              />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value || `${label}-${option.label}`}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${option.value === (value ?? "") ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-ink hover:bg-slate-50 dark:hover:bg-slate-800/80"}`}
                  >
                    <span>{option.label}</span>
                    {option.value === (value ?? "") ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const Filter = Select;

export function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-panel text-slate-400 dark:text-slate-500" aria-hidden="true">•••</div>
      <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="h-36 animate-pulse overflow-hidden rounded-2xl border border-line/70 bg-surface bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)] bg-[length:400px_100%]" />
      ))}
    </div>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function applyTheme(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("vih_theme", next);
    } catch {
      // The theme still applies when persistent storage is unavailable.
    }
  }

  return (
    <div className={`inline-flex rounded-xl border border-line bg-panel p-1 ${compact ? "w-full" : ""}`} aria-label="Appearance">
      {([
        ["light", Sun, "Light"],
        ["dark", Moon, "Dark"]
      ] as const).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => applyTheme(value)}
          aria-pressed={theme === value}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-150 ${
            theme === value
              ? "bg-brand-600 text-white shadow-glow"
              : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/5"
          } ${compact ? "flex-1 justify-center" : ""}`}
        >
          <Icon size={15} /> {!compact ? label : ""}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`animate-slide-up max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">CRM form</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-panel dark:text-slate-300">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/35 backdrop-blur-[2px]">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-surface p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">Lead 360</div>
            <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-panel dark:text-slate-300">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Initials badge for a person or company, in the brand tint. */
export function Avatar({ name, size = 28, square = false }: { name: string; size?: number; square?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter((part) => /[A-Za-z]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={`inline-flex shrink-0 items-center justify-center bg-brand-100 font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-200 ${square ? "rounded-lg" : "rounded-full"}`}
    >
      {initials || "?"}
    </span>
  );
}
