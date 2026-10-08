// Helpers for the DateField picker. Values use the same local strings as native inputs:
// "YYYY-MM-DD" for dates and "YYYY-MM-DDTHH:mm" for date + time, so forms and APIs are unchanged.

export type DateFieldMode = "date" | "datetime";

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toFieldValue(date: Date, mode: DateFieldMode) {
  return mode === "date" ? toDateValue(date) : `${toDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a field value as a local date; returns null for empty or malformed values. */
export function parseFieldValue(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh = "0", mm = "0"] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timeLabel(hours: number, minutes: number) {
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${pad(minutes)} ${suffix}`;
}

/** "Thu, 9 Oct 2026" or "Thu, 9 Oct 2026 · 10:00 AM". */
export function formatFieldValue(value: string | null | undefined, mode: DateFieldMode) {
  const date = parseFieldValue(value);
  if (!date) return "";
  const weekday = date.toLocaleDateString("en-IN", { weekday: "short" });
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const day = `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`;
  return mode === "date" ? day : `${day} · ${timeLabel(date.getHours(), date.getMinutes())}`;
}

/** Time options every 30 minutes across the working day, as "HH:mm". */
export const TIME_OPTIONS = Array.from({ length: 29 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

function at(date: Date, hours: number, minutes = 0) {
  const copy = new Date(date);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** One-click choices shown above the calendar. */
export function quickPicks(mode: DateFieldMode, now = new Date()) {
  const nextMonday = addDays(now, ((8 - now.getDay()) % 7) || 7);
  const picks: { label: string; date: Date }[] =
    mode === "datetime"
      ? [
          ...(now.getHours() < 16 ? [{ label: "Today, 5 PM", date: at(now, 17) }] : []),
          { label: "Tomorrow, 10 AM", date: at(addDays(now, 1), 10) },
          { label: "In 3 days", date: at(addDays(now, 3), 10) },
          { label: "Next Monday", date: at(nextMonday, 10) }
        ]
      : [
          { label: "Today", date: at(now, 0) },
          { label: "Tomorrow", date: at(addDays(now, 1), 0) },
          { label: "Next Monday", date: at(nextMonday, 0) },
          { label: "1st of next month", date: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
        ];
  return picks.map((pick) => ({ label: pick.label, value: toFieldValue(pick.date, mode) }));
}

/** Calendar cells for a month view, Monday-first, padded with null before the 1st. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array.from({ length: leading }, () => null), ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1))];
}
