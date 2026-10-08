import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthToPeriod } from "@/lib/validators";
import { growthPct as computeGrowth, lastMonths, sumByMonth } from "@/lib/dashboard-metrics";

const LEADERSHIP_ROLES = ["CEO", "ADMIN", "CSO", "CFO"];

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function status(count: number, amberAt = 1, redAt = 3): "green" | "amber" | "red" {
  if (count >= redAt) return "red";
  if (count >= amberAt) return "amber";
  return "green";
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!LEADERSHIP_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });

  const { periodStart, periodEnd } = monthToPeriod(month);
  const previousMonth = shiftMonth(month, -1);
  const { periodStart: prevStart, periodEnd: prevEnd } = monthToPeriod(previousMonth);
  const now = new Date();
  const months = lastMonths(month, 6);
  const windowStart = months[0].start;

  const [
    newLeads,
    newOpportunities,
    wonCustomers,
    pipeline,
    priceApprovalCounts,
    approvedThisMonth,
    onboardingCounts,
    customerCounts,
    newCustomers,
    activatedCustomers,
    smsUsage,
    wabaUsage,
    billingThisMonth,
    billingPrevMonth,
    billingByService,
    reconciliationCounts,
    adjustmentsThisMonth,
    invoicesRaised,
    collectionsReceived,
    operationsTasksPending,
    platformIssues,
    billingRunsInWindow,
    paymentsInWindow,
    leadsInWindow,
    wonInWindow,
    pipelineByStage,
    openInvoices
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: periodStart, lte: periodEnd }, deletedAt: null } }),
    prisma.opportunity.count({ where: { createdAt: { gte: periodStart, lte: periodEnd }, deletedAt: null } }),
    prisma.customer.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.opportunity.aggregate({ where: { status: { notIn: ["WON", "LOST"] }, deletedAt: null }, _sum: { opportunityValue: true } }),
    prisma.priceApprovalRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.priceApprovalRequest.aggregate({
      where: { status: "APPROVED", reviewedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { expectedMonthlyRevenue: true },
      _count: { _all: true }
    }),
    prisma.onboardingChecklist.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.customer.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.customer.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.customer.count({ where: { activatedAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.usageRecord.groupBy({ by: ["component"], where: { service: "SMS", usageDate: { gte: periodStart, lte: periodEnd } }, _sum: { quantity: true } }),
    prisma.usageRecord.groupBy({ by: ["component"], where: { service: "WHATSAPP", usageDate: { gte: periodStart, lte: periodEnd } }, _sum: { quantity: true } }),
    prisma.billingRun.aggregate({ where: { periodStart }, _sum: { totalAmount: true, totalSetupAmount: true } }),
    prisma.billingRun.aggregate({ where: { periodStart: prevStart }, _sum: { totalAmount: true } }),
    prisma.billingLineItem.groupBy({ by: ["service"], where: { billingRun: { periodStart } }, _sum: { amount: true } }),
    prisma.reconciliation.groupBy({ by: ["status"], where: { billingRun: { periodStart } }, _count: { _all: true } }),
    prisma.adjustment.groupBy({ by: ["type"], where: { createdAt: { gte: periodStart, lte: periodEnd } }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { issueDate: { gte: periodStart, lte: periodEnd } } }),
    prisma.payment.aggregate({ where: { paidOn: { gte: periodStart, lte: periodEnd } }, _sum: { amount: true } }),
    prisma.onboardingTask.count({ where: { team: "OPERATIONS", status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.platformAccount.count({ where: { status: { not: "ACTIVE" } } }),
    prisma.billingRun.findMany({ where: { periodStart: { gte: windowStart, lte: periodEnd } }, select: { periodStart: true, totalAmount: true } }),
    prisma.payment.findMany({ where: { paidOn: { gte: windowStart, lte: periodEnd } }, select: { paidOn: true, amount: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: windowStart, lte: periodEnd }, deletedAt: null }, select: { createdAt: true } }),
    prisma.opportunity.findMany({ where: { status: "WON", updatedAt: { gte: windowStart, lte: periodEnd }, deletedAt: null }, select: { updatedAt: true, opportunityValue: true } }),
    prisma.opportunity.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true }, _sum: { opportunityValue: true } }),
    prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "EXPORTED", "OVERDUE"] } }, select: { totalAmount: true, dueDate: true, payments: { select: { amount: true } } } })
  ]);

  const revenueTrend = sumByMonth(billingRunsInWindow.map((row) => ({ date: row.periodStart, amount: Number(row.totalAmount) })), months);
  const collectedTrend = sumByMonth(paymentsInWindow.map((row) => ({ date: row.paidOn, amount: Number(row.amount) })), months);
  const leadTrend = sumByMonth(leadsInWindow.map((row) => ({ date: row.createdAt, amount: 1 })), months);
  const wonTrend = sumByMonth(wonInWindow.map((row) => ({ date: row.updatedAt, amount: Number(row.opportunityValue) })), months);
  const stageMap = new Map(pipelineByStage.map((row) => [row.status, { count: row._count._all, value: Number(row._sum.opportunityValue ?? 0) }]));
  // Net receivables: invoice total minus payments already received (matches the Finance dashboard).
  const balances = openInvoices
    .map((invoice) => ({ dueDate: invoice.dueDate, balance: Number(invoice.totalAmount) - invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) }))
    .filter((invoice) => invoice.balance > 0);
  const netOutstanding = { count: balances.length, amount: balances.reduce((sum, invoice) => sum + invoice.balance, 0) };
  const overdueBalances = balances.filter((invoice) => invoice.dueDate < now);
  const netOverdue = { count: overdueBalances.length, amount: overdueBalances.reduce((sum, invoice) => sum + invoice.balance, 0) };

  const parStatusMap = new Map(priceApprovalCounts.map((row) => [row.status, row._count._all]));
  const onboardingMap = new Map(onboardingCounts.map((row) => [row.status, row._count._all]));
  const customerStatusMap = new Map(customerCounts.map((row) => [row.status, row._count._all]));
  const billingByServiceMap = new Map(billingByService.map((row) => [row.service, Number(row._sum.amount ?? 0)]));
  const reconMap = new Map(reconciliationCounts.map((row) => [row.status, row._count._all]));
  const adjustmentMap = new Map(adjustmentsThisMonth.map((row) => [row.type, Number(row._sum.amount ?? 0)]));

  const smsSubmitted = smsUsage.find((r) => r.component === "SUBMITTED")?._sum.quantity ?? 0;
  const smsDelivered = smsUsage.find((r) => r.component === "DELIVERED")?._sum.quantity ?? 0;
  const wabaByCategory = wabaUsage.map((row) => ({ category: row.component, quantity: row._sum.quantity ?? 0 }));

  const currentTotalBilling = Number(billingThisMonth._sum.totalAmount ?? 0);
  const previousTotalBilling = Number(billingPrevMonth._sum.totalAmount ?? 0);
  const growthPct = computeGrowth(currentTotalBilling, previousTotalBilling);

  const blockedOnboarding = onboardingMap.get("BLOCKED") ?? 0;
  const discrepancies = reconMap.get("DISCREPANCY") ?? 0;
  const pendingApprovals = parStatusMap.get("SUBMITTED") ?? 0;
  const rejectedApprovals = parStatusMap.get("REJECTED") ?? 0;

  const alerts: { severity: "amber" | "red"; message: string }[] = [];
  if (netOverdue.count > 0) {
    alerts.push({ severity: "red", message: `${netOverdue.count} overdue invoice(s) totaling ₹${netOverdue.amount.toLocaleString("en-IN")}` });
  }
  if (blockedOnboarding > 0) alerts.push({ severity: "red", message: `${blockedOnboarding} customer onboarding checklist(s) blocked` });
  if (discrepancies > 0) alerts.push({ severity: "amber", message: `${discrepancies} billing run(s) have a reconciliation discrepancy` });
  if (pendingApprovals > 0) alerts.push({ severity: "amber", message: `${pendingApprovals} price approval request(s) awaiting review` });
  if (rejectedApprovals > 0) alerts.push({ severity: "amber", message: `${rejectedApprovals} price approval request(s) were rejected` });
  if (platformIssues > 0) alerts.push({ severity: "amber", message: `${platformIssues} platform account(s) are not active` });

  return NextResponse.json({
    month,
    sales: {
      newLeads,
      newOpportunities,
      wonCustomers,
      pipelineValue: Number(pipeline._sum.opportunityValue ?? 0),
      approvedPricingRequests: approvedThisMonth._count._all,
      status: newLeads > 0 || newOpportunities > 0 ? "green" : "amber"
    },
    priceApprovals: {
      pending: pendingApprovals,
      approved: approvedThisMonth._count._all,
      rejected: rejectedApprovals,
      approvedValue: Number(approvedThisMonth._sum.expectedMonthlyRevenue ?? 0),
      status: status(rejectedApprovals, 1, 3)
    },
    onboarding: {
      newCustomers,
      activated: activatedCustomers,
      inProgress: onboardingMap.get("IN_PROGRESS") ?? 0,
      delayed: blockedOnboarding,
      status: status(blockedOnboarding, 1, 3)
    },
    customers: {
      total: customerCounts.reduce((sum, r) => sum + r._count._all, 0),
      new: newCustomers,
      active: customerStatusMap.get("ACTIVE") ?? 0,
      inactive: (customerStatusMap.get("INACTIVE") ?? 0) + (customerStatusMap.get("SUSPENDED") ?? 0)
    },
    usage: { smsSubmitted, smsDelivered, wabaByCategory },
    billing: {
      serviceWise: { SMS: billingByServiceMap.get("SMS") ?? 0, WHATSAPP: billingByServiceMap.get("WHATSAPP") ?? 0 },
      setupCharges: Number(billingThisMonth._sum.totalSetupAmount ?? 0),
      totalBilling: currentTotalBilling,
      previousMonthTotal: previousTotalBilling,
      growthPct
    },
    finance: {
      billingCompleted: reconciliationCounts.reduce((sum, r) => sum + r._count._all, 0),
      pendingReconciliation: (reconMap.get("PENDING") ?? 0) + discrepancies,
      creditsTotal: adjustmentMap.get("CREDIT") ?? 0,
      debitsTotal: adjustmentMap.get("DEBIT") ?? 0,
      outstanding: netOutstanding.amount,
      overdue: netOverdue.amount,
      status: status((reconMap.get("PENDING") ?? 0) + discrepancies, 1, 3)
    },
    operations: {
      customersPendingActivation: customerStatusMap.get("ONBOARDING") ?? 0,
      technicalTasksPending: operationsTasksPending,
      platformIssues,
      status: status(platformIssues, 1, 3)
    },
    collections: {
      invoicesRaised,
      outstandingCount: netOutstanding.count,
      outstandingAmount: netOutstanding.amount,
      overdueCount: netOverdue.count,
      overdueAmount: netOverdue.amount,
      collectionsReceived: Number(collectionsReceived._sum.amount ?? 0),
      status: status(netOverdue.count, 1, 3)
    },
    trend: months.map((m, index) => ({ month: m.key, label: m.label, revenue: revenueTrend[index], collected: collectedTrend[index], newLeads: leadTrend[index], wonValue: wonTrend[index] })),
    pipelineByStage: (["NEW", "QUALIFYING", "PROPOSAL", "WON", "LOST"] as const).map((stage) => ({ stage, count: stageMap.get(stage)?.count ?? 0, value: stageMap.get(stage)?.value ?? 0 })),
    alerts
  });
}
