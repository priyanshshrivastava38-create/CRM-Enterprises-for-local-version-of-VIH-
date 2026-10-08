import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBilling } from "@/lib/rbac";
import { agingBuckets, lastMonths, sumByMonth } from "@/lib/dashboard-metrics";

const OPEN_INVOICE_STATUSES = ["ISSUED", "EXPORTED", "OVERDUE"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBilling(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const months = lastMonths(now.toISOString().slice(0, 7), 6);
  const currentMonth = months[months.length - 1];
  const windowStart = months[0].start;

  const [pendingReviewCount, reconciliationCounts, adjustments, openInvoices, recentInvoices, invoicesInWindow, paymentsInWindow] = await Promise.all([
    prisma.billingRun.count({ where: { status: { in: ["CALCULATED", "UNDER_REVIEW"] } } }),
    prisma.reconciliation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.adjustment.groupBy({ by: ["type"], where: { createdAt: { gte: currentMonth.start, lte: currentMonth.end } }, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { status: { in: [...OPEN_INVOICE_STATUSES] } },
      select: { totalAmount: true, dueDate: true, customer: { select: { name: true, customerCode: true } }, payments: { select: { amount: true } } }
    }),
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 5,
      include: { customer: { select: { customerCode: true, name: true } } }
    }),
    prisma.invoice.findMany({ where: { issueDate: { gte: windowStart }, status: { not: "CANCELLED" } }, select: { issueDate: true, totalAmount: true } }),
    prisma.payment.findMany({ where: { paidOn: { gte: windowStart } }, select: { paidOn: true, amount: true } })
  ]);

  const reconMap = new Map(reconciliationCounts.map((row) => [row.status, row._count._all]));
  const adjustmentMap = new Map(adjustments.map((row) => [row.type, Number(row._sum.amount ?? 0)]));

  // Outstanding is the unpaid balance (invoice total minus payments received), not the gross invoice value.
  const balances = openInvoices.map((invoice) => ({
    customer: invoice.customer,
    dueDate: invoice.dueDate,
    balance: Number(invoice.totalAmount) - invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  })).filter((invoice) => invoice.balance > 0);
  const overdue = balances.filter((invoice) => invoice.dueDate < now);

  const byCustomer = new Map<string, { name: string; customerCode: string; amount: number; invoices: number }>();
  for (const invoice of balances) {
    const entry = byCustomer.get(invoice.customer.customerCode) ?? { ...invoice.customer, amount: 0, invoices: 0 };
    entry.amount += invoice.balance;
    entry.invoices += 1;
    byCustomer.set(invoice.customer.customerCode, entry);
  }

  const billed = sumByMonth(invoicesInWindow.map((row) => ({ date: row.issueDate, amount: Number(row.totalAmount) })), months);
  const collected = sumByMonth(paymentsInWindow.map((row) => ({ date: row.paidOn, amount: Number(row.amount) })), months);

  return NextResponse.json({
    pendingReviewCount,
    reconciliationCounts: {
      PENDING: reconMap.get("PENDING") ?? 0,
      MATCHED: reconMap.get("MATCHED") ?? 0,
      DISCREPANCY: reconMap.get("DISCREPANCY") ?? 0,
      RESOLVED: reconMap.get("RESOLVED") ?? 0
    },
    adjustmentsThisMonth: { creditTotal: adjustmentMap.get("CREDIT") ?? 0, debitTotal: adjustmentMap.get("DEBIT") ?? 0 },
    billedThisMonth: billed[billed.length - 1],
    collectedThisMonth: collected[collected.length - 1],
    outstanding: { count: balances.length, amount: balances.reduce((sum, invoice) => sum + invoice.balance, 0) },
    overdue: { count: overdue.length, amount: overdue.reduce((sum, invoice) => sum + invoice.balance, 0) },
    aging: agingBuckets(balances, now),
    topOutstanding: [...byCustomer.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
    trend: months.map((month, index) => ({ month: month.key, label: month.label, billed: billed[index], collected: collected[index] })),
    recentInvoices: recentInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      customerCode: inv.customer.customerCode,
      customerName: inv.customer.name,
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate
    }))
  });
}
