// Pure helpers shared by the dashboard API routes (kept free of Prisma so they are unit-testable).

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthBucket = { key: string; label: string; start: Date; end: Date };

/** The `count` calendar months ending with `endMonth` ("YYYY-MM"), oldest first, as UTC ranges. */
export function lastMonths(endMonth: string, count: number): MonthBucket[] {
  const [year, month] = endMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const offset = index - (count - 1);
    const start = new Date(Date.UTC(year, month - 1 + offset, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: `${MONTH_LABELS[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)}`, start, end };
  });
}

/** Sums `amount` per month bucket; rows outside every bucket are ignored. */
export function sumByMonth(rows: { date: Date; amount: number }[], months: MonthBucket[]) {
  const totals = months.map(() => 0);
  for (const row of rows) {
    const time = row.date.getTime();
    const index = months.findIndex((month) => time >= month.start.getTime() && time <= month.end.getTime());
    if (index !== -1) totals[index] += row.amount;
  }
  return totals;
}

export const AGING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

/** Groups open invoice balances by how many days past due they are. */
export function agingBuckets(invoices: { dueDate: Date; balance: number }[], now: Date) {
  const buckets = AGING_BUCKETS.map((label) => ({ label, amount: 0, count: 0 }));
  for (const invoice of invoices) {
    if (invoice.balance <= 0) continue;
    const daysPastDue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / 86_400_000);
    const index = daysPastDue <= 0 ? 0 : daysPastDue <= 30 ? 1 : daysPastDue <= 60 ? 2 : daysPastDue <= 90 ? 3 : 4;
    buckets[index].amount += invoice.balance;
    buckets[index].count += 1;
  }
  return buckets;
}

/** Percentage change from `previous` to `current`, one decimal; null when there is no baseline. */
export function growthPct(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Win probability assumed at each opportunity stage, used for the weighted (forecast) pipeline value. */
export const STAGE_PROBABILITY: Record<string, number> = { NEW: 0.1, QUALIFYING: 0.3, PROPOSAL: 0.6, WON: 1, LOST: 0 };

/** Open pipeline total and its probability-weighted forecast; won and lost deals are excluded. */
export function pipelineForecast(deals: { status: string; value: number }[]) {
  const open = deals.filter((deal) => deal.status !== "WON" && deal.status !== "LOST");
  return {
    openValue: open.reduce((sum, deal) => sum + deal.value, 0),
    weightedValue: Math.round(open.reduce((sum, deal) => sum + deal.value * (STAGE_PROBABILITY[deal.status] ?? 0), 0))
  };
}
