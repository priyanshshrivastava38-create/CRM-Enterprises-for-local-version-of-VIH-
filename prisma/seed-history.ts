// Six months of trading history for the demo: extra customers billed month by month through the real
// approval → billing → invoice workflows, then back-dated so dashboards show realistic trends,
// collections, aging, and a couple of genuine exceptions (overdue invoices, a reconciliation discrepancy).
import type { PrismaClient } from "@prisma/client";
import { approvePriceRequest } from "../lib/workflows/approve-price-request";
import { runBillingForCustomer } from "../lib/workflows/run-billing";
import { finalizeBillingRun } from "../lib/workflows/finalize-billing-run";
import { getOrCreateReconciliation } from "../lib/workflows/reconcile-billing-run";

type Users = { sales: { id: string }; ceo: { id: string }; finance: { id: string }; operations: { id: string } };

const DAY = 86_400_000;

function monthStart(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

function monthEnd(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0, 23, 59, 59, 999));
}

const rateCard = [
  {
    service: "SMS" as const,
    component: "SUBMITTED",
    rateType: "SLAB" as const,
    billingMetric: "PER_UNIT",
    sortOrder: 0,
    slabs: { create: [{ minVolume: 0, maxVolume: 1000000, rate: 0.18, sortOrder: 0 }, { minVolume: 1000001, maxVolume: null, rate: 0.16, sortOrder: 1 }] }
  },
  {
    service: "SMS" as const,
    component: "DELIVERED",
    rateType: "SLAB" as const,
    billingMetric: "PER_UNIT",
    sortOrder: 1,
    slabs: { create: [{ minVolume: 0, maxVolume: 800000, rate: 0.25, sortOrder: 0 }, { minVolume: 800001, maxVolume: null, rate: 0.23, sortOrder: 1 }] }
  },
  { service: "WHATSAPP" as const, component: "MARKETING", rateType: "FLAT" as const, flatRate: 0.85, billingMetric: "PER_UNIT", sortOrder: 2 },
  { service: "WHATSAPP" as const, component: "UTILITY", rateType: "FLAT" as const, flatRate: 0.35, billingMetric: "PER_UNIT", sortOrder: 3 },
  { service: "WHATSAPP" as const, component: "AUTHENTICATION", rateType: "FLAT" as const, flatRate: 0.4, billingMetric: "PER_UNIT", sortOrder: 4 }
];

// startOffset: months before the current month the customer went live. Volumes grow by `growth` each month.
const CUSTOMERS = [
  { name: "Swift Logistics", contact: "Rohan Mehta", city: "Mumbai", gst: "27AAACS1234A1Z1", startOffset: -5, sms: 900000, marketing: 40000, utility: 90000, auth: 20000, growth: 1.09, setup: 20000, overdueOffset: -3 },
  { name: "PayEase Fintech", contact: "Kavya Iyer", city: "Bengaluru", gst: "29AAACP5678B1Z2", startOffset: -5, sms: 1400000, marketing: 10000, utility: 60000, auth: 180000, growth: 1.06, setup: 30000 },
  { name: "MedCare Clinics", contact: "Dr. Anil Rao", city: "Hyderabad", gst: "36AAACM9012C1Z3", startOffset: -4, sms: 420000, marketing: 15000, utility: 70000, auth: 10000, growth: 1.05, setup: 15000, overdueOffset: -2 },
  { name: "UrbanNest Realty", contact: "Sneha Kapoor", city: "Pune", gst: "27AAACU3456D1Z4", startOffset: -3, sms: 300000, marketing: 160000, utility: 30000, auth: 5000, growth: 1.12, setup: 18000, discrepancyOffset: -1 },
  { name: "Northstar Bank", contact: "Vikram Joshi", city: "Gurugram", gst: "06AAACN7890E1Z5", startOffset: -2, sms: 2200000, marketing: 25000, utility: 150000, auth: 260000, growth: 1.04, setup: 50000 }
];

const OPEN_PIPELINE = [
  { company: "EduSpark Academy", contact: "Neha Bansal", value: 640000, status: "PROPOSAL" as const, createdOffsetDays: -21 },
  { company: "FreshKart Grocers", contact: "Aditya Reddy", value: 980000, status: "PROPOSAL" as const, createdOffsetDays: -34 },
  { company: "CityCare Diagnostics", contact: "Meera Menon", value: 420000, status: "QUALIFYING" as const, createdOffsetDays: -12 },
  { company: "Zenith Insurance", contact: "Karan Chopra", value: 1500000, status: "QUALIFYING" as const, createdOffsetDays: -26 },
  { company: "BluePeak Travels", contact: "Isha Agarwal", value: 260000, status: "NEW" as const, createdOffsetDays: -4 },
  { company: "Orbit Telecom Retail", contact: "Sameer Gupta", value: 720000, status: "NEW" as const, createdOffsetDays: -2 }
];

export async function seedHistory(prisma: PrismaClient, users: Users) {
  const now = new Date();
  let requestSeq = 100;

  for (const spec of CUSTOMERS) {
    const goLive = monthStart(spec.startOffset);
    const slug = spec.name.toLowerCase().replace(/[^a-z]+/g, "");
    const annualValue = Math.round((spec.sms * 0.41 + spec.marketing * 0.85 + spec.utility * 0.35 + spec.auth * 0.4) * 12 / 10000) * 10000;

    const opportunity = await prisma.opportunity.create({
      data: {
        name: `${spec.name} — Messaging Services`,
        companyName: spec.name,
        contactName: spec.contact,
        contactEmail: `${spec.contact.split(" ").pop()!.toLowerCase()}@${slug}.in`,
        contactPhone: `+91 98${String(10000000 + requestSeq * 7919).slice(0, 8)}`,
        billingAddress: `${spec.city}, India`,
        gstNumber: spec.gst,
        expectedStartDate: goLive,
        opportunityValue: annualValue,
        status: "PROPOSAL",
        salesOwnerId: users.sales.id,
        createdAt: new Date(goLive.getTime() - 40 * DAY),
        requirements: { create: [{ service: "SMS", expectedMonthlyVolume: spec.sms }, { service: "WHATSAPP", expectedMonthlyVolume: spec.marketing + spec.utility + spec.auth }] }
      }
    });

    const request = await prisma.priceApprovalRequest.create({
      data: {
        requestNumber: `PAR-${String(++requestSeq).padStart(6, "0")}`,
        opportunityId: opportunity.id,
        requestedById: users.sales.id,
        status: "SUBMITTED",
        proposedEffectiveDate: goLive,
        setupCost: spec.setup,
        paymentTerms: "Net 30",
        commercialTerms: "Annual contract, billed monthly in arrears.",
        expectedMonthlyRevenue: Math.round(annualValue / 12),
        expectedMarginPct: 32,
        reason: "Standard rate card.",
        createdAt: new Date(goLive.getTime() - 20 * DAY),
        lineItems: { create: rateCard }
      }
    });

    const approved = await approvePriceRequest(request.id, users.ceo.id, "Approved — standard rate card.");
    const customerId = approved.customerId;
    const wonAt = new Date(goLive.getTime() - 12 * DAY);
    await prisma.priceApprovalRequest.update({ where: { id: request.id }, data: { reviewedAt: wonAt } });
    await prisma.opportunity.update({ where: { id: opportunity.id }, data: { updatedAt: wonAt } });
    await prisma.customer.update({ where: { id: customerId }, data: { status: "ACTIVE", createdAt: wonAt, activatedAt: new Date(goLive.getTime() - 2 * DAY) } });
    const checklist = await prisma.onboardingChecklist.findUnique({ where: { customerId } });
    if (checklist) {
      await prisma.onboardingTask.updateMany({ where: { checklistId: checklist.id }, data: { status: "COMPLETED", completedAt: goLive, completedById: users.operations.id } });
      await prisma.onboardingChecklist.update({ where: { id: checklist.id }, data: { status: "COMPLETED", startedAt: wonAt, completedAt: goLive } });
    }

    const [smsAccount, wabaAccount] = await Promise.all([
      prisma.platformAccount.create({ data: { customerId, service: "SMS", externalAccountId: `SMS-${slug.slice(0, 6).toUpperCase()}`, providerName: "Karix SMS Gateway", adapterKey: "MOCK", status: "ACTIVE" } }),
      prisma.platformAccount.create({ data: { customerId, service: "WHATSAPP", externalAccountId: `WABA-${slug.slice(0, 6).toUpperCase()}`, providerName: "Meta Cloud API", adapterKey: "MOCK", status: "ACTIVE" } })
    ]);

    for (let offset = spec.startOffset, month = 0; offset <= 0; offset++, month++) {
      const start = monthStart(offset);
      const end = monthEnd(offset);
      const factor = Math.pow(spec.growth, month);
      const mid = new Date(start.getTime() + 14 * DAY);
      const usageDate = offset === 0 ? new Date(Math.min(mid.getTime(), now.getTime())) : mid;
      const sms = Math.round(spec.sms * factor);
      const batch = await prisma.usageImportBatch.create({ data: { uploadedById: users.operations.id, service: "SMS", status: "COMPLETED", rowCount: 5, successCount: 5, errorCount: 0, createdAt: new Date(end.getTime() + DAY) } });
      await prisma.usageRecord.createMany({
        data: [
          { importBatchId: batch.id, platformAccountId: smsAccount.id, service: "SMS", component: "SUBMITTED", usageDate, quantity: sms, sourceReference: `hist-${slug}-${month}-s` },
          { importBatchId: batch.id, platformAccountId: smsAccount.id, service: "SMS", component: "DELIVERED", usageDate, quantity: Math.round(sms * 0.82), sourceReference: `hist-${slug}-${month}-d` },
          { importBatchId: batch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "MARKETING", usageDate, quantity: Math.round(spec.marketing * factor), sourceReference: `hist-${slug}-${month}-m` },
          { importBatchId: batch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "UTILITY", usageDate, quantity: Math.round(spec.utility * factor), sourceReference: `hist-${slug}-${month}-u` },
          { importBatchId: batch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "AUTHENTICATION", usageDate, quantity: Math.round(spec.auth * factor), sourceReference: `hist-${slug}-${month}-a` }
        ]
      });

      const run = await runBillingForCustomer(customerId, start, end);
      const reconciliation = await getOrCreateReconciliation(run.id);
      const invoice = await finalizeBillingRun(run.id, users.finance.id);

      // Back-date to how the month would really have been closed: invoiced on the 2nd, Net 30.
      const issueDate = offset === 0 ? now : new Date(end.getTime() + 2 * DAY);
      const dueDate = new Date(issueDate.getTime() + 30 * DAY);
      const total = Number(invoice.totalAmount);
      const isOverdue = spec.overdueOffset === offset;
      const isLastMonth = offset === -1;
      const reconStatus = spec.discrepancyOffset === offset ? "DISCREPANCY" : offset >= -1 ? "PENDING" : "MATCHED";
      await prisma.reconciliation.update({ where: { id: reconciliation.id }, data: { status: reconStatus, reviewedById: reconStatus === "MATCHED" ? users.finance.id : null, reviewedAt: reconStatus === "MATCHED" ? new Date(end.getTime() + DAY) : null } });

      let paid = 0;
      if (!isOverdue && offset <= -2) paid = total;
      else if (isLastMonth && month % 2 === 0) paid = Math.round(total * 0.5 * 100) / 100;
      if (paid > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: paid,
            paidOn: new Date(Math.min(issueDate.getTime() + (18 + month * 2) * DAY, now.getTime() - DAY)),
            method: "BANK_TRANSFER",
            reference: `NEFT-${slug.slice(0, 4).toUpperCase()}-${start.toISOString().slice(0, 7)}`,
            recordedById: users.finance.id
          }
        });
      }
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { issueDate, dueDate, status: paid >= total ? "PAID" : dueDate < now ? "OVERDUE" : "ISSUED" }
      });
      await prisma.billingRun.update({ where: { id: run.id }, data: { calculatedAt: new Date(end.getTime() + DAY), finalizedAt: issueDate } });
    }
  }

  for (const [index, deal] of OPEN_PIPELINE.entries()) {
    const slug = deal.company.toLowerCase().replace(/[^a-z]+/g, "");
    const createdAt = new Date(now.getTime() + deal.createdOffsetDays * DAY);
    await prisma.opportunity.create({
      data: {
        name: `${deal.company} — Messaging Services`,
        companyName: deal.company,
        contactName: deal.contact,
        contactEmail: `${deal.contact.split(" ").pop()!.toLowerCase()}@${slug}.in`,
        contactPhone: `+91 97${String(20000000 + index * 104729).slice(0, 8)}`,
        opportunityValue: deal.value,
        status: deal.status,
        expectedStartDate: new Date(now.getTime() + (30 + index * 10) * DAY),
        salesOwnerId: users.sales.id,
        createdAt,
        updatedAt: createdAt,
        requirements: { create: [{ service: "SMS", expectedMonthlyVolume: Math.round(deal.value / 5) }] }
      }
    });
  }
}
