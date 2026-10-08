import { format, isToday, isPast } from "date-fns";

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function dateLabel(value?: string | Date | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  return format(date, "dd MMM yyyy");
}

export function taskBucket(dueDate: Date, completed: boolean) {
  if (completed) return "Completed";
  if (Number.isNaN(dueDate.getTime())) return "Overdue";
  if (isToday(dueDate)) return "Today";
  if (isPast(dueDate)) return "Overdue";
  return "Upcoming";
}

export function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Short Indian-notation currency for tiles and axes: ₹4.2K, ₹5.2L, ₹1.04Cr. */
export function inrCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number, digits: number) => n.toFixed(digits).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7, 2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5, 1)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3, 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}
