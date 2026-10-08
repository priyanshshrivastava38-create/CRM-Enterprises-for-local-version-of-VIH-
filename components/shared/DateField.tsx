"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { TIME_OPTIONS, formatFieldValue, monthGrid, parseFieldValue, quickPicks, timeLabel, toDateValue, toFieldValue, type DateFieldMode } from "@/lib/date-field";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const PANEL_WIDTH = 304;

/**
 * Friendly date / date-time picker that replaces the browser's "dd/mm/yyyy, --:-- --" input.
 * Emits the same value strings as native inputs ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm").
 */
export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  required = false,
  placeholder
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  mode?: DateFieldMode;
  required?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const selected = parseFieldValue(value);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const today = toDateValue(new Date());
  const picks = useMemo(() => quickPicks(mode), [mode]);
  const time = selected ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}` : "10:00";

  // Keep the panel anchored to the trigger (fixed position, flipping above when there's no room below).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = panelRef.current?.offsetHeight ?? 420;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 && rect.top - height - 6 > 8 ? rect.top - height - 6 : below;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
      setPosition({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickDay(day: Date) {
    if (mode === "date") {
      onChange(toDateValue(day));
      setOpen(false);
      return;
    }
    onChange(`${toDateValue(day)}T${time}`);
  }

  function pickTime(next: string) {
    onChange(`${toDateValue(selected ?? new Date())}T${next}`);
  }

  function openPanel() {
    const base = selected ?? new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen((current) => !current);
  }

  const cells = monthGrid(viewMonth.getFullYear(), viewMonth.getMonth());
  const display = formatFieldValue(value, mode);

  return (
    <div className="relative block">
      <label htmlFor={id} className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="relative mt-2">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          onClick={openPanel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex h-10 w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left text-sm outline-none transition-all duration-150 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 ${open ? "border-brand-500 ring-4 ring-brand-500/10" : "border-line hover:border-brand-300"}`}
        >
          <CalendarDays size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className={`flex-1 truncate ${display ? "text-ink" : "text-slate-400"}`}>{display || placeholder || (mode === "date" ? "Select a date" : "Select date & time")}</span>
        </button>
        {display && !required ? (
          <button type="button" onClick={() => onChange("")} aria-label={`Clear ${label}`} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-panel hover:text-ink">
            <X size={14} />
          </button>
        ) : null}
        {/* Keeps native "required" form validation working for the custom control. */}
        {required ? <input tabIndex={-1} aria-hidden="true" required value={value ?? ""} onChange={() => undefined} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" /> : null}
      </div>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={`Choose ${label.toLowerCase()}`}
              style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: PANEL_WIDTH }}
              className="fixed z-[70] rounded-2xl border border-line bg-surface p-3 shadow-2xl"
            >
              <div className="flex flex-wrap gap-1.5">
                {picks.map((pick) => (
                  <button
                    key={pick.label}
                    type="button"
                    onClick={() => {
                      onChange(pick.value);
                      setOpen(false);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${value === pick.value ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "border-line text-slate-600 hover:border-brand-300 hover:text-ink dark:text-slate-300"}`}
                  >
                    {pick.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-ink">{viewMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mt-1 grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="py-1">{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, index) => {
                  if (!day) return <span key={`blank-${index}`} />;
                  const key = toDateValue(day);
                  const isSelected = selected ? key === toDateValue(selected) : false;
                  const isToday = key === today;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickDay(day)}
                      aria-label={day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      aria-pressed={isSelected}
                      className={`flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${
                        isSelected ? "bg-brand-600 font-semibold text-white" : isToday ? "font-semibold text-brand-700 ring-1 ring-inset ring-brand-300 hover:bg-brand-50 dark:text-brand-300" : "text-ink hover:bg-panel"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              {mode === "datetime" ? (
                <label className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Time
                  <select value={TIME_OPTIONS.includes(time) ? time : ""} onChange={(event) => pickTime(event.target.value)} className="h-9 flex-1 rounded-lg border border-line bg-surface px-2 text-sm font-normal text-ink outline-none focus:border-brand-500">
                    {!TIME_OPTIONS.includes(time) ? <option value="">{selected ? timeLabel(selected.getHours(), selected.getMinutes()) : "Pick a time"}</option> : null}
                    {TIME_OPTIONS.map((option) => {
                      const [h, m] = option.split(":").map(Number);
                      return (
                        <option key={option} value={option}>
                          {timeLabel(h, m)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : null}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <button type="button" onClick={() => onChange(toFieldValue(mode === "date" ? new Date() : new Date(new Date().setMinutes(Math.ceil(new Date().getMinutes() / 30) * 30, 0, 0)), mode))} className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
                  {mode === "date" ? "Today" : "Now"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                  Done
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
