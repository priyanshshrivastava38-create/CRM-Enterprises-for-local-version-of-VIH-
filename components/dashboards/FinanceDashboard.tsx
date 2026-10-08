"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CircleDollarSign, ClipboardCheck, Landmark, Wallet } from "lucide-react";
import { Badge, Empty, LoadingGrid } from "@/components/shared/ui";
import { BarList, CardLink, ChartCard, EmptyState, KpiTile, Meter, TrendChart } from "@/components/dashboards/kit";
import { dateLabel, inr, inrCompact, titleCase } from "@/lib/format";

type FinanceData = {
  pendingReviewCount: number;
  reconciliationCounts: { PENDING: number; MATCHED: number; DISCREPANCY: number; RESOLVED: number };
  adjustmentsThisMonth: { creditTotal: number; debitTotal: number };
  billedThisMonth: number;
  collectedThisMonth: number;
  outstanding: { count: number; amount: number };
  overdue: { count: number; amount: number };
  aging: { label: string; amount: number; count: number }[];
  topOutstanding: { name: string; customerCode: string; amount: number; invoices: number }[];
  trend: { month: string; label: string; billed: number; collected: number }[];
  recentInvoices: { invoiceNumber: string; customerCode: string; customerName: string; totalAmount: number; status: string; issueDate: string; dueDate: string }[];
};

const invoiceTone: Record<string, string> = { PAID: "green", ISSUED: "blue", EXPORTED: "blue", OVERDUE: "red", DRAFT: "slate", CANCELLED: "slate" };

/** Briefing line for the page header, e.g. "₹6.8L overdue across 2 invoices · 5 billing runs to reconcile." */
function financeHeadline(data: FinanceData) {
  const parts = [
    data.overdue.amount > 0 ? `${inrCompact(data.overdue.amount)} overdue across ${data.overdue.count} invoice${data.overdue.count === 1 ? "" : "s"}` : "Nothing overdue",
    `${inrCompact(data.collectedThisMonth)} collected this month`
  ];
  const toReconcile = data.reconciliationCounts.PENDING + data.reconciliationCounts.DISCREPANCY;
  if (toReconcile) parts.push(`${toReconcile} billing run${toReconcile === 1 ? "" : "s"} to reconcile`);
  return `${parts.join(" · ")}.`;
}

export function FinanceDashboard({ header }: { header: (headline: string | null) => React.ReactNode }) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboards/finance")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Could not load the finance dashboard."))))
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div className="space-y-6">{header(null)}<Empty label={error} /></div>;
  if (!data) return <div className="space-y-6">{header(null)}<LoadingGrid /></div>;

  const recon = data.reconciliationCounts;
  const reconTotal = recon.PENDING + recon.MATCHED + recon.DISCREPANCY + recon.RESOLVED;
  const sixMonthBilled = data.trend.reduce((sum, row) => sum + row.billed, 0);
  const sixMonthCollected = data.trend.reduce((sum, row) => sum + row.collected, 0);

  return (
    <div className="space-y-6">
      {header(financeHeadline(data))}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <KpiTile label="Billed this month" icon={CircleDollarSign} href="/billing" value={inrCompact(data.billedThisMonth)} footer={<span className="text-xs text-slate-500 dark:text-slate-400">Invoices issued in the current month</span>} />
        <KpiTile label="Collected this month" icon={Wallet} href="/invoices" value={inrCompact(data.collectedThisMonth)} footer={<span className="text-xs text-slate-500 dark:text-slate-400">Payments received so far</span>} />
        <KpiTile
          label="Outstanding receivables"
          icon={Landmark}
          href="/invoices"
          value={inrCompact(data.outstanding.amount)}
          footer={
            <span className={`text-xs ${data.overdue.amount > 0 ? "font-semibold text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
              {data.overdue.amount > 0 ? `${inrCompact(data.overdue.amount)} overdue across ${data.overdue.count} invoice(s)` : `${data.outstanding.count} open invoice(s) · none overdue`}
            </span>
          }
        />
        <KpiTile
          label="Awaiting review"
          icon={ClipboardCheck}
          href="/billing"
          value={data.pendingReviewCount + recon.DISCREPANCY}
          footer={<span className="text-xs text-slate-500 dark:text-slate-400">{data.pendingReviewCount} billing run(s) · {recon.DISCREPANCY} discrepancy(ies)</span>}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3 print:grid-cols-3">
        <ChartCard title="Billed vs collected" subtitle="Invoiced amount and cash received, last 6 months" className="xl:col-span-2 print:col-span-2" action={<CardLink href="/invoices">Invoices</CardLink>}>
          <TrendChart
            data={data.trend}
            series={[
              { key: "billed", name: "Billed", color: "var(--series-1)" },
              { key: "collected", name: "Collected", color: "var(--series-2)" }
            ]}
            format={inr}
            axisFormat={inrCompact}
            empty="No invoices or payments in the last 6 months."
          />
        </ChartCard>
        <ChartCard title="Collection efficiency" subtitle="Last 6 months">
          <div className="space-y-5">
            <Meter label="Cash collected vs billed" value={sixMonthCollected} total={sixMonthBilled} format={inrCompact} />
            <Meter label="Billing runs reconciled" value={recon.MATCHED + recon.RESOLVED} total={reconTotal} format={(value) => String(value)} />
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Credits this month</div>
                <div className="mt-0.5 font-semibold tabular-nums text-ink">{inr(data.adjustmentsThisMonth.creditTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Debits this month</div>
                <div className="mt-0.5 font-semibold tabular-nums text-ink">{inr(data.adjustmentsThisMonth.debitTotal)}</div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
        <ChartCard title="Receivables aging" subtitle="Unpaid balance by days past due">
          <BarList items={data.aging.map((bucket) => ({ label: bucket.label, value: bucket.amount, detail: bucket.count ? `· ${bucket.count}` : undefined }))} format={inrCompact} empty="No unpaid invoices." />
        </ChartCard>
        <ChartCard title="Top outstanding customers" subtitle="Largest unpaid balances" action={<CardLink href="/customers">Customers</CardLink>}>
          <BarList items={data.topOutstanding.map((row) => ({ label: `${row.name}`, value: row.amount, detail: `· ${row.invoices} inv` }))} format={inrCompact} empty="No customer has an unpaid balance." />
        </ChartCard>
        <ChartCard title="Reconciliation status" subtitle="All billing runs" action={<CardLink href="/reconciliation">Reconcile</CardLink>}>
          <ul className="divide-y divide-line text-sm">
            {(["PENDING", "DISCREPANCY", "MATCHED", "RESOLVED"] as const).map((status) => (
              <li key={status} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  {status === "DISCREPANCY" && recon[status] > 0 ? <AlertTriangle size={14} className="text-amber-600" aria-hidden="true" /> : null}
                  {titleCase(status)}
                </span>
                <span className="font-semibold tabular-nums text-ink">{recon[status]}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <ChartCard title="Recent invoices" subtitle="Latest five issued" action={<CardLink href="/invoices">All invoices</CardLink>}>
        {data.recentInvoices.length ? (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr className="border-b border-line">
                  <th className="px-5 pb-2.5 font-medium">Invoice</th>
                  <th className="px-5 pb-2.5 font-medium">Customer</th>
                  <th className="px-5 pb-2.5 font-medium">Issued</th>
                  <th className="px-5 pb-2.5 font-medium">Due</th>
                  <th className="px-5 pb-2.5 text-right font-medium">Amount</th>
                  <th className="px-5 pb-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line whitespace-nowrap">
                {data.recentInvoices.map((invoice) => (
                  <tr key={invoice.invoiceNumber}>
                    <td className="px-5 py-3"><Link href="/invoices" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">{invoice.invoiceNumber}</Link></td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{invoice.customerName} <span className="text-slate-400">· {invoice.customerCode}</span></td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{dateLabel(invoice.issueDate)}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{dateLabel(invoice.dueDate)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">{inr(invoice.totalAmount)}</td>
                    <td className="px-5 py-3"><Badge tone={invoiceTone[invoice.status] ?? "slate"}>{titleCase(invoice.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No invoices issued yet.</EmptyState>
        )}
      </ChartCard>
    </div>
  );
}
