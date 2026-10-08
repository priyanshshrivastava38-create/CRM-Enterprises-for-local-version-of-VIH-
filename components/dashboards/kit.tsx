"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Download, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/shared/ui";

// Building blocks for the role dashboards. Chart colors come from the validated --series-* tokens in globals.css.

export type Health = "green" | "amber" | "red";

const HEALTH: Record<Health, { label: string; icon: LucideIcon; className: string }> = {
  green: { label: "On track", icon: CheckCircle2, className: "text-emerald-700 dark:text-emerald-400" },
  amber: { label: "Needs attention", icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
  red: { label: "At risk", icon: XCircle, className: "text-red-700 dark:text-red-400" }
};

export function HealthBadge({ status }: { status: Health }) {
  const { label, icon: Icon, className } = HEALTH[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      <Icon size={14} aria-hidden="true" /> {label}
    </span>
  );
}

export function Delta({ value, goodWhenUp = true, suffix = "vs last month" }: { value: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (value == null) return <span className="text-xs text-slate-500 dark:text-slate-400">No prior month to compare</span>;
  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={`inline-flex items-center font-semibold ${good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
        <Icon size={14} aria-hidden="true" />
        {up ? "+" : ""}
        {value}%
      </span>
      <span className="text-slate-500 dark:text-slate-400">{suffix}</span>
    </span>
  );
}

export function KpiTile({
  label,
  value,
  footer,
  icon: Icon,
  href
}: {
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {Icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Icon size={16} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="mt-2 truncate text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">{value}</div>
      {footer ? <div className="mt-1.5 min-h-[18px]">{footer}</div> : null}
    </>
  );
  const className = "block min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card";
  if (href) {
    return (
      <Link href={href} className={`${className} transition-colors hover:border-brand-300 dark:hover:border-brand-700`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400 print:hidden">
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[140px] items-center justify-center rounded-xl bg-panel px-4 text-center text-sm text-slate-500 dark:text-slate-400">{children}</div>;
}

/** Ranked horizontal bars for one measure; every value is printed, so the bars never carry meaning alone. */
export function BarList({
  items,
  format = (value) => value.toLocaleString("en-IN"),
  empty = "No data yet."
}: {
  items: { label: string; value: number; detail?: string; href?: string }[];
  format?: (value: number) => string;
  empty?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  if (!items.length || max === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{item.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {format(item.value)}
                {item.detail ? <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">{item.detail}</span> : null}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }} />
            </div>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className="block rounded-lg transition-opacity hover:opacity-80">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Series = { key: string; name: string; color: string };

/** Monthly bars for one or two series, with a legend (2+ series), tooltip, and a table view. */
export function TrendChart({
  data,
  series,
  format = (value) => value.toLocaleString("en-IN"),
  axisFormat = format,
  empty = "No activity in this period yet.",
  height = 240
}: {
  data: Record<string, string | number>[];
  series: Series[];
  format?: (value: number) => string;
  axisFormat?: (value: number) => string;
  empty?: string;
  height?: number;
}) {
  const [asTable, setAsTable] = useState(false);
  const hasData = data.some((row) => series.some((s) => Number(row[s.key]) > 0));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {series.length > 1 ? (
          <ul className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                {s.name}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        {hasData ? (
          <button type="button" onClick={() => setAsTable((value) => !value)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-panel hover:text-ink dark:text-slate-400 print:hidden">
            {asTable ? "View chart" : "View table"}
          </button>
        ) : null}
      </div>

      {!hasData ? (
        <EmptyState>{empty}</EmptyState>
      ) : asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Month</th>
                {series.map((s) => (
                  <th key={s.key} className="py-2 pr-4 text-right font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((row) => (
                <tr key={String(row.label)}>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{row.label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-2 pr-4 text-right tabular-nums text-ink">{format(Number(row[s.key]))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
              <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "var(--chart-text)" }} tickFormatter={(value) => axisFormat(Number(value))} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--panel)" }}
                formatter={(value, name) => [format(Number(value)), name]}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--ink)" }}
                labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
              />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** A labelled share-of-total meter, e.g. collection rate. */
export function Meter({ label, value, total, format }: { label: string; value: number; total: number; format: (value: number) => string }) {
  const share = total > 0 ? Math.min(Math.round((value / total) * 100), 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{share}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel">
        <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {format(value)} of {format(total)}
      </div>
    </div>
  );
}

/** Opens the browser print dialog; print styles turn the dashboard into an A4 report ("Save as PDF"). */
export function DownloadReportButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-panel print:hidden">
      <Download size={16} aria-hidden="true" /> Download PDF
    </button>
  );
}

/** Branded header that only appears on the printed / PDF report. */
export function ReportHeader({ title, period }: { title: string; period: string }) {
  return (
    <div className="mb-6 hidden items-end justify-between border-b border-line pb-4 print:flex">
      <div className="flex items-center gap-4">
        <img src="/logo-light.png" alt="ViH Metaverse" className="h-10 w-auto" />
        <div>
          <div className="text-lg font-semibold text-ink">{title}</div>
          <div className="text-sm text-slate-500">{period}</div>
        </div>
      </div>
      <div className="text-right text-xs text-slate-500">
        Generated {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        <br />
        Confidential — internal use only
      </div>
    </div>
  );
}
