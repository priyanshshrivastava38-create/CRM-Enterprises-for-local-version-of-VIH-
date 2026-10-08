import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageBilling } from "@/lib/rbac";
import { calculateReceivables } from "@/lib/finance-metrics";

function monthRange(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1) - 1);
  return { start, end };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageBilling(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { start: currentStart, end: currentEnd } = monthRange(0);
  const now = new Date();

  const [pendingReviewCount, reconciliationCounts, adjustments, invoices, invoicesIssuedThisMonth, collectionsThisMonth, collectionsForCurrentInvoices, recentInvoices] = await Promise.all([
    prisma.billingRun.count({ where: { status: { in: ["CALCULATED", "UNDER_REVIEW"] } } }),
    prisma.reconciliation.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.adjustment.groupBy({ by: ["type"], where: { createdAt: { gte: currentStart, lte: currentEnd } }, _sum: { amount: true } }),
    prisma.invoice.findMany({ where: { status: { not: "CANCELLED" } }, select: { totalAmount: true, dueDate: true, status: true, payments: { select: { amount: true } } } }),
    prisma.invoice.aggregate({ where: { issueDate: { gte: currentStart, lte: currentEnd }, status: { not: "CANCELLED" } }, _sum: { totalAmount: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { paidOn: { gte: currentStart, lte: currentEnd } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { paidOn: { gte: currentStart, lte: currentEnd }, invoice: { issueDate: { gte: currentStart, lte: currentEnd }, status: { not: "CANCELLED" } } }, _sum: { amount: true } }),
    prisma.invoice.findMany({
      orderBy: { issueDate: "desc" },
      take: 5,
      include: { customer: { select: { customerCode: true, name: true } }, payments: { select: { amount: true } } }
    })
  ]);

  const reconMap = new Map(reconciliationCounts.map((row) => [row.status, row._count._all]));
  const adjustmentMap = new Map(adjustments.map((row) => [row.type, Number(row._sum.amount ?? 0)]));
  const receivables = calculateReceivables(invoices.map((invoice) => ({
    totalAmount: Number(invoice.totalAmount),
    dueDate: invoice.dueDate,
    status: invoice.status,
    payments: invoice.payments.map((payment) => ({ amount: Number(payment.amount) }))
  })), now);
  const invoicedThisMonth = Number(invoicesIssuedThisMonth._sum.totalAmount ?? 0);
  const collectedThisMonth = Number(collectionsThisMonth._sum.amount ?? 0);
  const collectionsForCurrentInvoicesAmount = Number(collectionsForCurrentInvoices._sum.amount ?? 0);

  return NextResponse.json({
    pendingReviewCount,
    reconciliationCounts: {
      PENDING: reconMap.get("PENDING") ?? 0,
      MATCHED: reconMap.get("MATCHED") ?? 0,
      DISCREPANCY: reconMap.get("DISCREPANCY") ?? 0,
      RESOLVED: reconMap.get("RESOLVED") ?? 0
    },
    adjustmentsThisMonth: { creditTotal: adjustmentMap.get("CREDIT") ?? 0, debitTotal: adjustmentMap.get("DEBIT") ?? 0 },
    revenueThisMonth: invoicedThisMonth,
    collectionsThisMonth: collectedThisMonth,
    collectionRate: invoicedThisMonth > 0 ? Math.round((collectionsForCurrentInvoicesAmount / invoicedThisMonth) * 1000) / 10 : null,
    outstanding: { count: receivables.openInvoiceCount, amount: receivables.outstandingAmount },
    overdue: { count: receivables.overdueInvoiceCount, amount: receivables.overdueAmount },
    aging: receivables.aging,
    recentInvoices: recentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerCode: inv.customer.customerCode,
      customerName: inv.customer.name,
      totalAmount: Number(inv.totalAmount),
      amountDue: Math.max(0, Number(inv.totalAmount) - inv.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)),
      status: inv.status,
      issueDate: inv.issueDate
    }))
  });
}
