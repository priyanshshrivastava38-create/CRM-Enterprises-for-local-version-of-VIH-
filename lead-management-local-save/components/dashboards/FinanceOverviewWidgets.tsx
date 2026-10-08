"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/shared/ui";
import { titleCase } from "@/lib/format";

type Data = {
  pendingReviewCount: number;
  reconciliationCounts: { PENDING: number; MATCHED: number; DISCREPANCY: number; RESOLVED: number };
  adjustmentsThisMonth: { creditTotal: number; debitTotal: number };
  revenueThisMonth: number;
  collectionsThisMonth: number;
  collectionRate: number | null;
  outstanding: { count: number; amount: number };
  overdue: { count: number; amount: number };
  aging: { current: number; days1To30: number; days31To60: number; days61To90: number; days90Plus: number };
  recentInvoices: { id: string; invoiceNumber: string; customerCode: string; customerName: string; totalAmount: number; amountDue: number; status: string; issueDate: string }[];
};

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function statusTone(status: string) {
  if (status === "PAID") return "green";
  if (status === "CANCELLED") return "red";
  return "blue";
}

export function FinanceOverviewWidgets() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/dashboards/finance")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Revenue invoiced this month", data.revenueThisMonth],
          ["Cash collected this month", data.collectionsThisMonth],
          ["Outstanding receivables", data.outstanding.amount],
          ["Overdue receivables", data.overdue.amount]
        ].map(([label, amount]) => (
          <Card key={label as string} className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-2 text-xl font-semibold text-ink">{inr(amount as number)}</div>
            {label === "Cash collected this month" ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Collection rate: {data.collectionRate == null ? "—" : `${data.collectionRate}%`}</div> : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <h3 className="font-semibold text-ink">Billing & Reconciliation</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Pending Review</span>
            <span className="font-semibold text-ink">{data.pendingReviewCount}</span>
          </div>
          {Object.entries(data.reconciliationCounts).map(([status, count]) => (
            <div key={status} className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{titleCase(status)}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-ink">Outstanding & Overdue</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Outstanding</span>
            <span className="font-semibold text-ink">
              {inr(data.outstanding.amount)} ({data.outstanding.count})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Overdue</span>
            <span className={data.overdue.count > 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}>
              {inr(data.overdue.amount)} ({data.overdue.count})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Credits (this month)</span>
            <span>{inr(data.adjustmentsThisMonth.creditTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Debits (this month)</span>
            <span>{inr(data.adjustmentsThisMonth.debitTotal)}</span>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-ink">Receivables Aging</h3>
        <div className="mt-3 space-y-2 text-sm">
          {[
            ["Current", data.aging.current],
            ["1–30 days", data.aging.days1To30],
            ["31–60 days", data.aging.days31To60],
            ["61–90 days", data.aging.days61To90],
            ["90+ days", data.aging.days90Plus]
          ].map(([label, amount]) => (
            <div key={label as string} className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className={`font-medium ${(label === "61–90 days" || label === "90+ days") && Number(amount) > 0 ? "text-red-600 dark:text-red-400" : "text-ink"}`}>{inr(amount as number)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="font-semibold text-ink">Recent Invoices</h3>
        <div className="mt-3 space-y-2">
          {data.recentInvoices.length ? (
            data.recentInvoices.map((inv) => (
              <Link key={inv.invoiceNumber} href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-panel">
                <span className="min-w-0"><span className="block truncate font-medium text-ink">{inv.invoiceNumber} · {inv.customerCode}</span><span className="text-xs text-slate-500">Due {inr(inv.amountDue)}</span></span>
                <Badge tone={statusTone(inv.status)}>{titleCase(inv.status)}</Badge>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No invoices yet.</p>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}
