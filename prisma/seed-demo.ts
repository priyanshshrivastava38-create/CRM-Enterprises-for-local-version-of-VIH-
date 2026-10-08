import {
  BillingRunStatus,
  ImportStatus,
  InvoiceStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
  OpportunityStatus,
  PriceApprovalStatus,
  Priority,
  PrismaClient,
  RateType,
  ReconciliationStatus,
  ServiceType,
  TaskStatus,
  TaskType
} from "@prisma/client";
import { nextCustomerCode, nextInvoiceNumber, nextRequestNumber } from "../lib/numbering";

const prisma = new PrismaClient();
const markerCampaign = "CRM DEMO DATASET — SAFE ADDITIVE SEED v1";
const markerLeadEmail = "demo.lifecycle@crm-demo.invalid";

async function main() {
  if (process.env.DEMO_DATA_CONFIRM !== "YES") {
    throw new Error("Refusing to write demo data. Set DEMO_DATA_CONFIRM=YES to confirm additive inserts.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to add demo data when NODE_ENV=production.");
  }

  const existingMarker = await prisma.campaign.findFirst({ where: { name: markerCampaign }, select: { id: true } });
  if (existingMarker) {
    console.log("Demo data already exists; no rows were changed.");
    return;
  }

  const sales = await prisma.user.findFirst({ where: { role: "SALES", active: true }, orderBy: { createdAt: "asc" } });
  const ceo = await prisma.user.findFirst({ where: { role: "CEO", active: true }, orderBy: { createdAt: "asc" } });
  const finance = await prisma.user.findFirst({ where: { role: "FINANCE", active: true }, orderBy: { createdAt: "asc" } });
  const operations = await prisma.user.findFirst({ where: { role: "OPERATIONS", active: true }, orderBy: { createdAt: "asc" } });
  if (!sales || !ceo || !finance || !operations) {
    throw new Error("Active Sales, CEO, Finance, and Operations users must exist before adding the demo dataset.");
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const periodStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  const periodEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
  const campaignStart = new Date(Date.UTC(currentYear, currentMonth - 2, 1));
  const campaignEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
  const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: { name: markerCampaign, source: "Referral", status: "ACTIVE", startDate: campaignStart, endDate: campaignEnd, budget: 180000 }
    });
    const organization = await tx.organization.create({
      data: {
        name: "Northstar Demo Communications",
        industry: "Technology",
        website: "https://demo.example.invalid",
        city: "Bengaluru",
        country: "India",
        phone: "+91 80000 10001",
        email: "hello@northstar-demo.example.invalid",
        tags: ["Demo", "Communications"]
      }
    });
    const contact = await tx.contact.create({
      data: {
        firstName: "Aarav",
        lastName: "Demo",
        email: "aarav.demo@northstar-demo.example.invalid",
        phone: "+91 80000 10002",
        jobTitle: "Operations Director",
        department: "Technology",
        organizationId: organization.id,
        city: "Bengaluru",
        country: "India",
        notes: "Sample CRM contact created by the additive demo-data command."
      }
    });

    const leads = await Promise.all([
      tx.lead.create({
        data: {
          firstName: "Aarav", lastName: "Demo", email: markerLeadEmail, phone: "+91 80000 10003",
          company: organization.name, designation: "Operations Director", city: "Bengaluru", source: "Referral",
          status: "CONVERTED", priority: Priority.HOT, score: 88, assignedTo: sales.id, organizationId: organization.id,
          contactId: contact.id, campaignId: campaign.id, notes: "Demo lifecycle lead connected to an opportunity, customer, onboarding, and invoice.",
          lastContactedAt: now, activities: { create: { userId: sales.id, activityType: "LEAD_CREATED", description: "Demo lifecycle lead created" } }
        }
      }),
      tx.lead.create({
        data: {
          firstName: "Diya", lastName: "Sample", email: "diya.sample@crm-demo.invalid", phone: "+91 80000 10004",
          company: "Bright Retail Demo", designation: "Marketing Manager", city: "Mumbai", source: "Website",
          status: "NEW", priority: Priority.WARM, score: 67, assignedTo: sales.id, campaignId: campaign.id,
          notes: "Sample new lead for pipeline views."
        }
      }),
      tx.lead.create({
        data: {
          firstName: "Kabir", lastName: "Sample", email: "kabir.sample@crm-demo.invalid", phone: "+91 80000 10005",
          company: "Metro Services Demo", designation: "Founder", city: "Pune", source: "Google",
          status: "FOLLOW_UP", priority: Priority.HOT, score: 81, assignedTo: sales.id,
          nextFollowUpAt: dueDate, notes: "Sample follow-up lead for task and SLA views."
        }
      }),
      tx.lead.create({
        data: {
          firstName: "Meera", lastName: "Sample", email: "meera.sample@crm-demo.invalid", phone: "+91 80000 10006",
          company: "Green Foods Demo", designation: "Procurement Lead", city: "Hyderabad", source: "Manual",
          status: "QUALIFIED", priority: Priority.WARM, score: 74, assignedTo: sales.id,
          notes: "Sample qualified lead for dashboard charts."
        }
      })
    ]);

    await tx.call.create({
      data: { leadId: leads[0].id, agentId: sales.id, type: "CALL", direction: "OUTBOUND", status: "CONNECTED", outcome: "Interested", duration: 8, notes: "Demo discovery call." }
    });
    await tx.task.createMany({
      data: [
        { title: "Demo: follow up on proposal", description: "Sample open follow-up task.", type: TaskType.FOLLOW_UP, status: TaskStatus.OPEN, priority: Priority.HOT, dueDate, assignedTo: sales.id, leadId: leads[2].id },
        { title: "Demo: verify customer details", description: "Sample customer operations task.", type: TaskType.OTHER, status: TaskStatus.OPEN, priority: Priority.WARM, dueDate, assignedTo: operations.id, leadId: leads[0].id }
      ]
    });

    const opportunity = await tx.opportunity.create({
      data: {
        leadId: leads[0].id,
        name: `${organization.name} — Messaging Services`,
        companyName: organization.name,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email!,
        contactPhone: contact.phone!,
        billingAddress: "Demo Business Park, Bengaluru, India",
        gstNumber: "29ABCDE1234F1Z5",
        expectedStartDate: periodStart,
        opportunityValue: 37200,
        status: OpportunityStatus.WON,
        salesOwnerId: sales.id,
        requirements: {
          create: [
            { service: ServiceType.SMS, expectedMonthlyVolume: 100000, notes: "Demo transactional traffic." },
            { service: ServiceType.WHATSAPP, expectedMonthlyVolume: 10000, notes: "Demo marketing conversations." }
          ]
        },
        documents: { create: { title: "Demo service proposal", url: "https://example.invalid/demo-proposal", uploadedById: sales.id } },
        activities: { create: { userId: sales.id, activityType: "OPPORTUNITY_CREATED", description: "Demo opportunity created from a converted lead" } }
      }
    });

    const requestNumber = await nextRequestNumber(tx);
    const priceRequest = await tx.priceApprovalRequest.create({
      data: {
        requestNumber,
        opportunityId: opportunity.id,
        requestedById: sales.id,
        reviewedById: ceo.id,
        reviewedAt: now,
        status: PriceApprovalStatus.APPROVED,
        proposedEffectiveDate: periodStart,
        setupCost: 15000,
        paymentTerms: "Net 30",
        commercialTerms: "Demo pricing for CRM feature walkthrough.",
        expectedMonthlyRevenue: 37200,
        expectedMarginPct: 35,
        reason: "Additive demonstration data; no real commercial offer.",
        reviewComments: "Approved for demo only.",
        lineItems: {
          create: [
            { service: ServiceType.SMS, component: "DELIVERED", rateType: RateType.FLAT, flatRate: 0.08, expectedVolume: 100000, billingMetric: "PER_UNIT", sortOrder: 0 },
            { service: ServiceType.WHATSAPP, component: "MARKETING", rateType: RateType.FLAT, flatRate: 0.42, expectedVolume: 10000, billingMetric: "PER_UNIT", sortOrder: 1 }
          ]
        }
      },
      include: { lineItems: true }
    });

    const customerCode = await nextCustomerCode(tx);
    const customer = await tx.customer.create({
      data: {
        customerCode,
        opportunityId: opportunity.id,
        name: organization.name,
        billingAddress: "Demo Business Park, Bengaluru, India",
        gstNumber: "29ABCDE1234F1Z5",
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactEmail: contact.email!,
        contactPhone: contact.phone!,
        accountManagerId: sales.id,
        status: "ONBOARDING"
      }
    });
    const plan = await tx.ratePlan.create({
      data: {
        customerId: customer.id, sourceRequestId: priceRequest.id, effectiveFrom: periodStart, status: "ACTIVE",
        lineItems: {
          create: priceRequest.lineItems.map((item, index) => ({
            service: item.service, component: item.component, rateType: item.rateType, flatRate: item.flatRate,
            billingMetric: item.billingMetric, sortOrder: index
          }))
        }
      }, include: { lineItems: true }
    });
    await tx.priceApprovalRequest.update({ where: { id: priceRequest.id }, data: { customerId: customer.id } });
    await tx.setupCharge.create({ data: { customerId: customer.id, ratePlanId: plan.id, amount: 15000, status: "INVOICED", chargeDate: now } });

    const checklist = await tx.onboardingChecklist.create({
      data: {
        customerId: customer.id, status: OnboardingStatus.IN_PROGRESS, startedAt: now,
        tasks: {
          create: [
            { team: "SALES", title: "Demo: confirm customer information", status: OnboardingTaskStatus.COMPLETED, isRequired: true, assignedToId: sales.id, completedById: sales.id, completedAt: now, sortOrder: 0 },
            { team: "FINANCE", title: "Demo: verify billing details", status: OnboardingTaskStatus.PENDING, isRequired: true, assignedToId: finance.id, dueDate, sortOrder: 1 },
            { team: "OPERATIONS", title: "Demo: configure platform account", status: OnboardingTaskStatus.IN_PROGRESS, isRequired: true, assignedToId: operations.id, dueDate, sortOrder: 2 },
            { team: "OPERATIONS", title: "Demo: send test message", status: OnboardingTaskStatus.PENDING, isRequired: true, assignedToId: operations.id, dueDate, sortOrder: 3 }
          ]
        }
      }
    });

    const smsAccount = await tx.platformAccount.create({
      data: { customerId: customer.id, service: ServiceType.SMS, externalAccountId: "DEMO-SMS-001", providerName: "Demo SMS Gateway", adapterKey: "MOCK", status: "ACTIVE" }
    });
    const whatsappAccount = await tx.platformAccount.create({
      data: { customerId: customer.id, service: ServiceType.WHATSAPP, externalAccountId: "DEMO-WABA-001", providerName: "Demo WhatsApp Provider", adapterKey: "MOCK", status: "ACTIVE" }
    });
    const batch = await tx.usageImportBatch.create({
      data: { uploadedById: operations.id, fileName: "crm-demo-usage.csv", service: ServiceType.SMS, status: ImportStatus.COMPLETED, rowCount: 2, successCount: 2, errorCount: 0 }
    });
    await tx.usageRecord.createMany({
      data: [
        { importBatchId: batch.id, platformAccountId: smsAccount.id, service: ServiceType.SMS, component: "DELIVERED", usageDate: new Date(Date.UTC(currentYear, currentMonth - 1, 12)), quantity: 60000, sourceReference: "DEMO-SMS-001-SEP-A" },
        { importBatchId: batch.id, platformAccountId: smsAccount.id, service: ServiceType.SMS, component: "DELIVERED", usageDate: new Date(Date.UTC(currentYear, currentMonth - 1, 24)), quantity: 40000, sourceReference: "DEMO-SMS-001-SEP-B" },
        { importBatchId: batch.id, platformAccountId: whatsappAccount.id, service: ServiceType.WHATSAPP, component: "MARKETING", usageDate: new Date(Date.UTC(currentYear, currentMonth - 1, 18)), quantity: 10000, sourceReference: "DEMO-WABA-001-SEP-A" }
      ]
    });

    const smsAmount = 100000 * 0.08;
    const whatsappAmount = 10000 * 0.42;
    const usageAmount = smsAmount + whatsappAmount;
    const totalAmount = usageAmount + 15000;
    const run = await tx.billingRun.create({
      data: {
        customerId: customer.id, ratePlanId: plan.id, periodStart, periodEnd,
        status: BillingRunStatus.INVOICED, totalUsageAmount: usageAmount, totalSetupAmount: 15000,
        totalAdjustmentAmount: 0, totalAmount, calculatedAt: now, finalizedAt: now, finalizedById: finance.id,
        billableUsages: {
          create: [
            { service: ServiceType.SMS, component: "DELIVERED", rawQuantity: 100000, billableQuantity: 100000 },
            { service: ServiceType.WHATSAPP, component: "MARKETING", rawQuantity: 10000, billableQuantity: 10000 }
          ]
        },
        lineItems: {
          create: [
            { service: ServiceType.SMS, component: "DELIVERED", billableQuantity: 100000, rateType: RateType.FLAT, appliedRate: 0.08, amount: smsAmount, sortOrder: 0 },
            { service: ServiceType.WHATSAPP, component: "MARKETING", billableQuantity: 10000, rateType: RateType.FLAT, appliedRate: 0.42, amount: whatsappAmount, sortOrder: 1 }
          ]
        }
      }
    });
    const reconciliation = await tx.reconciliation.create({
      data: { billingRunId: run.id, status: ReconciliationStatus.MATCHED, totalRawQuantity: 110000, totalBillableQuantity: 110000, varianceQuantity: 0, varianceAmount: 0, reviewedById: finance.id, reviewedAt: now, notes: "Demo usage and billed quantities match." }
    });
    const invoiceNumber = await nextInvoiceNumber(tx, currentYear);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber, billingRunId: run.id, customerId: customer.id, periodStart, periodEnd,
        issueDate: now, dueDate, subtotal: usageAmount, setupCharges: 15000, adjustmentsTotal: 0,
        totalAmount, status: InvoiceStatus.PAID,
        lineItems: {
          create: [
            { lineType: "USAGE", service: ServiceType.SMS, component: "DELIVERED", description: "SMS — DELIVERED", quantity: 100000, rate: 0.08, amount: smsAmount, sortOrder: 0 },
            { lineType: "USAGE", service: ServiceType.WHATSAPP, component: "MARKETING", description: "WHATSAPP — MARKETING", quantity: 10000, rate: 0.42, amount: whatsappAmount, sortOrder: 1 },
            { lineType: "SETUP", description: "One-time setup charge", amount: 15000, sortOrder: 2 }
          ]
        },
        payments: { create: { amount: totalAmount, paidOn: now, method: "BANK_TRANSFER", reference: "DEMO-PAYMENT-001", recordedById: finance.id } }
      }
    });
    await tx.activity.createMany({
      data: [
        { leadId: leads[0].id, userId: sales.id, activityType: "CONVERTED_TO_OPPORTUNITY", description: "Demo lead converted to an opportunity." },
        { opportunityId: opportunity.id, userId: sales.id, activityType: "PRICE_APPROVED", description: `Demo price approval ${requestNumber} approved.` },
        { customerId: customer.id, userId: operations.id, activityType: "PLATFORM_MAPPED", description: "Demo SMS and WhatsApp platform accounts connected." },
        { customerId: customer.id, userId: finance.id, activityType: "INVOICE_ISSUED", description: `Demo invoice ${invoiceNumber} issued and paid.` }
      ]
    });
    await tx.notification.createMany({
      data: [
        { userId: sales.id, title: "Demo customer onboarded", message: `${customer.customerCode} is ready for platform setup.`, type: "ONBOARDING", entityType: "CUSTOMER", entityId: customer.id },
        { userId: operations.id, title: "Demo platform accounts mapped", message: "Sample SMS and WhatsApp accounts are ready for usage review.", type: "PLATFORM_MAPPING", entityType: "CUSTOMER", entityId: customer.id },
        { userId: finance.id, title: "Demo invoice paid", message: `${invoiceNumber} is available in the demo finance records.`, type: "INVOICE", entityType: "INVOICE", entityId: invoiceNumber }
      ]
    });

    return {
      organizations: 1,
      contacts: 1,
      leads: leads.length,
      calls: 1,
      tasks: 2,
      opportunities: 1,
      priceApprovals: 1,
      customers: 1,
      onboardingChecklists: 1,
      platformAccounts: 2,
      usageImportBatches: 1,
      usageRecords: 3,
      billingRuns: 1,
      reconciliations: 1,
      invoices: 1,
      payments: 1,
      notifications: 3,
      customerCode,
      requestNumber,
      invoiceNumber,
      reconciliationId: reconciliation.id,
      checklistId: checklist.id
    };
  }, { timeout: 30000, maxWait: 10000 });

  console.log("Additive demo dataset created successfully.");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error("Demo data seeding failed.", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
