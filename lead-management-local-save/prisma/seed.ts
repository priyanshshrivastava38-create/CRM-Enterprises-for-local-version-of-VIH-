import { PrismaClient, LeadStatus, Priority, TaskType } from "@prisma/client";
import { DEMO_ACCOUNTS } from "../lib/demo-accounts";
import { hashPassword } from "../lib/auth";
import { calculateLeadScore, priorityFromScore } from "../lib/scoring";
import { approvePriceRequest } from "../lib/workflows/approve-price-request";
import { runBillingForCustomer } from "../lib/workflows/run-billing";
import { finalizeBillingRun } from "../lib/workflows/finalize-billing-run";
import { getOrCreateReconciliation } from "../lib/workflows/reconcile-billing-run";

const prisma = new PrismaClient();

const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Shaurya", "Ananya", "Diya", "Ira", "Meera", "Anika", "Riya", "Kiara", "Saanvi", "Priya", "Nisha"];
const lastNames = ["Sharma", "Mehta", "Iyer", "Kapoor", "Nair", "Rao", "Patel", "Joshi", "Gupta", "Menon", "Bansal", "Agarwal", "Kulkarni", "Reddy", "Chopra"];
const cities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Ahmedabad", "Kolkata", "Gurugram", "Noida"];
const companies = ["Swift Logistics", "Bright Bazaar Retail", "PayEase Fintech", "MedCare Clinics", "EduSpark Academy", "QuickCart Online", "Metro Cabs", "Sunrise Foods", "UrbanNest Realty", "Northstar Bank"];
const sources = ["Website", "Facebook", "Instagram", "Google", "WhatsApp", "Referral", "Manual"];
const statuses = Object.values(LeadStatus);
const notes = [
  "Requested a callback and wants pricing for bulk WhatsApp notifications.",
  "Confirmed requirement for OTP + transactional SMS and asked for timeline.",
  "Interested but needs budget approval from leadership before signing.",
  "Asked for case studies and a follow-up next week.",
  "No response on first attempt.",
  "Wrong number mentioned by receptionist.",
  "High intent, wants a proposal for SMS + WABA marketing broadcasts."
];

function pick<T>(list: T[], index: number) {
  return list[index % list.length];
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(10 + (days % 8), 30, 0, 0);
  return date;
}

async function main() {
  const demoEmails = DEMO_ACCOUNTS.map((account) => account.email.toLowerCase().trim());

  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.adjustment.deleteMany();
  await prisma.reconciliation.deleteMany();
  await prisma.billingLineItem.deleteMany();
  await prisma.billableUsage.deleteMany();
  await prisma.billingRun.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.usageImportBatch.deleteMany();
  await prisma.platformAccount.deleteMany();
  await prisma.onboardingTask.deleteMany();
  await prisma.onboardingChecklist.deleteMany();
  await prisma.setupCharge.deleteMany();
  await prisma.rateSlab.deleteMany();
  await prisma.ratePlanLineItem.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.priceApprovalSlab.deleteMany();
  await prisma.priceApprovalLineItem.deleteMany();
  await prisma.priceApprovalRequest.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.opportunityDocument.deleteMany();
  await prisma.opportunityRequirement.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.call.deleteMany();
  await prisma.task.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });

  const demoUsers = await Promise.all(
    DEMO_ACCOUNTS.map(async (account) => {
      const normalizedEmail = account.email.trim().toLowerCase();
      const passwordHash = await hashPassword(account.password);
      return prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: account.name,
          password: passwordHash,
          role: account.role,
          active: true
        },
        create: {
          name: account.name,
          email: normalizedEmail,
          password: passwordHash,
          role: account.role,
          active: true
        }
      });
    })
  );

  const [sales, ceo, finance, operations] = [
    demoUsers.find((user) => user.email === "vih.sales@vih.demo"),
    demoUsers.find((user) => user.email === "vih.ceo@vih.demo"),
    demoUsers.find((user) => user.email === "vih.finance@vih.demo"),
    demoUsers.find((user) => user.email === "vih.tech@vih.demo")
  ];

  if (!sales || !ceo || !finance || !operations) {
    throw new Error("One or more required demo accounts were not created.");
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@vihmetaverse.com" },
    update: { role: "ADMIN", active: true },
    create: { name: "Vih Admin", email: "admin@vihmetaverse.com", password: await hashPassword(DEMO_ACCOUNTS[0].password), role: "ADMIN", active: true }
  });

  const agents = [sales, sales, sales];
  const campaigns = await Promise.all(
    ["SMS Growth Push", "Google Lead Sprint", "WhatsApp Callback Drive", "Referral Partner Week"].map((name, index) =>
      prisma.campaign.create({
        data: {
          name,
          source: pick(sources, index),
          status: index === 3 ? "PLANNED" : "ACTIVE",
          startDate: addDays(-20 + index * 5),
          endDate: addDays(20 + index * 8),
          budget: 120000 + index * 65000
        }
      })
    )
  );

  const organizations = await Promise.all(
    companies.map((name, index) =>
      prisma.organization.create({
        data: {
          name,
          industry: pick(["Logistics", "Retail", "Financial Services", "Healthcare", "Education", "Technology", "Transportation", "Food & Beverage", "Real Estate", "Banking"], index),
          website: `https://www.${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.in`,
          city: pick(cities, index),
          country: "India",
          phone: `+91 80${String(41000000 + index * 13791).slice(0, 8)}`,
          email: `hello@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.in`,
          tags: [index % 2 === 0 ? "Enterprise" : "Mid-market", index % 3 === 0 ? "Priority" : "Prospect"],
          contacts: {
            create: {
              firstName: pick(firstNames, index + 10),
              lastName: pick(lastNames, index + 4),
              email: `contact${index + 1}@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.in`,
              phone: `+91 98${String(10000000 + index * 19371).slice(0, 8)}`,
              jobTitle: pick(["Founder", "Marketing Head", "Sales Director", "Operations Lead", "Finance Controller"], index),
              department: pick(["Leadership", "Marketing", "Sales", "Operations", "Finance"], index),
              city: pick(cities, index),
              country: "India",
              notes: "Primary business contact for messaging platform evaluation."
            }
          }
        },
        include: { contacts: true }
      })
    )
  );
  const organizationsByName = new Map(organizations.map((organization) => [organization.name, organization]));

  for (let index = 0; index < 72; index++) {
    const firstName = pick(firstNames, index);
    const lastName = pick(lastNames, index * 3);
    const status = pick(statuses, index);
    const note = pick(notes, index);
    const organization = organizationsByName.get(pick(companies, index));
    const base = {
      firstName,
      lastName,
      email: `${firstName}.${lastName}.${index}@example.in`.toLowerCase(),
      phone: `+91 9${String(800000000 + index * 7321).slice(0, 9)}`,
      company: pick(companies, index),
      designation: pick(["Founder", "Marketing Head", "Sales Director", "Operations Lead", "CXO"], index),
      city: pick(cities, index),
      source: pick(sources, index),
      status,
      notes: note
    };
    const scoreResult = calculateLeadScore(base);
    const lead = await prisma.lead.create({
      data: {
        ...base,
        priority: priorityFromScore(scoreResult.score),
        score: scoreResult.score,
        assignedTo: sales.id,
        organizationId: organization?.id,
        contactId: organization?.contacts[0]?.id,
        campaignId: campaigns[index % campaigns.length].id,
        nextFollowUpAt: addDays((index % 9) - 3),
        lastContactedAt: ["CONTACTED", "QUALIFIED", "INTERESTED", "FOLLOW_UP", "CONVERTED"].includes(status) ? addDays(-1 - (index % 6)) : null,
        lostReason: status === "LOST" ? "Budget not approved this quarter" : null,
        createdAt: addDays(-index),
        activities: {
          create: [
            { userId: admin.id, activityType: "LEAD_CREATED", description: "Lead imported from demo seed", metadata: { source: base.source } },
            { userId: sales.id, activityType: "ASSIGNED", description: `Assigned to ${sales.name}` }
          ]
        }
      }
    });

    if (index % 2 === 0) {
      await prisma.call.create({
        data: {
          leadId: lead.id,
          agentId: sales.id,
          direction: "OUTBOUND",
          status: index % 8 === 0 ? "NO_ANSWER" : "CONNECTED",
          outcome: index % 8 === 0 ? "No answer" : pick(["Connected", "Interested", "Callback requested", "Not interested"], index),
          duration: index % 8 === 0 ? 0 : 4 + (index % 18),
          notes: note,
          transcript: `Agent discussed ViH's SMS/WhatsApp messaging platform with ${firstName}. ${note}`
        }
      });
    }

    await prisma.task.create({
      data: {
        title: index % 3 === 0 ? "Call for pricing discussion" : "Follow up on requirement",
        description: "Demo follow-up task linked to the lead.",
        type: pick(Object.values(TaskType), index),
        status: index % 7 === 0 ? "COMPLETED" : "OPEN",
        priority: index % 5 === 0 ? Priority.HOT : priorityFromScore(scoreResult.score),
        dueDate: addDays((index % 12) - 4),
        assignedTo: agents[index % agents.length].id,
        leadId: lead.id
      }
    });
  }

  // -------------------------------------------------------------------------
  // Opportunities & Price Approvals (Stage 2 demo data)
  // -------------------------------------------------------------------------

  const oppWon = await prisma.opportunity.create({
    data: {
      name: "Bright Bazaar Retail — Messaging Services",
      companyName: "Bright Bazaar Retail",
      contactName: "Priya Nair",
      contactEmail: "priya.nair@brightbazaar.in",
      contactPhone: "+91 9800112233",
      billingAddress: "14 MG Road, Bengaluru, Karnataka 560001",
      gstNumber: "29ABCDE1234F1Z5",
      expectedStartDate: addDays(5),
      opportunityValue: 1200000,
      status: "NEW",
      salesOwnerId: sales.id,
      activities: { create: { userId: sales.id, activityType: "OPPORTUNITY_CREATED", description: "Opportunity created by ViH Sales User" } },
      requirements: {
        create: [
          { service: "SMS", expectedMonthlyVolume: 2800000, notes: "Order confirmations, delivery updates and OTP" },
          { service: "WHATSAPP", expectedMonthlyVolume: 250000, notes: "Marketing broadcasts and utility notifications" }
        ]
      }
    }
  });

  const parApproved = await prisma.priceApprovalRequest.create({
    data: {
      requestNumber: "PAR-000001",
      opportunityId: oppWon.id,
      requestedById: sales.id,
      status: "SUBMITTED",
      proposedEffectiveDate: new Date("2026-09-01"),
      setupCost: 25000,
      paymentTerms: "Net 30",
      commercialTerms: "Annual contract, auto-renews unless cancelled with 30 days notice.",
      expectedMonthlyRevenue: 1004000,
      expectedMarginPct: 35,
      reason: "Standard onboarding pricing for a high-volume SMS + WhatsApp customer.",
      lineItems: {
        create: [
          {
            service: "SMS",
            component: "SUBMITTED",
            rateType: "SLAB",
            billingMetric: "PER_UNIT",
            sortOrder: 0,
            slabs: {
              create: [
                { minVolume: 0, maxVolume: 1000000, rate: 0.18, sortOrder: 0 },
                { minVolume: 1000001, maxVolume: 2500000, rate: 0.16, sortOrder: 1 },
                { minVolume: 2500001, maxVolume: null, rate: 0.14, sortOrder: 2 }
              ]
            }
          },
          {
            service: "SMS",
            component: "DELIVERED",
            rateType: "SLAB",
            billingMetric: "PER_UNIT",
            sortOrder: 1,
            slabs: {
              create: [
                { minVolume: 0, maxVolume: 800000, rate: 0.25, sortOrder: 0 },
                { minVolume: 800001, maxVolume: 2000000, rate: 0.23, sortOrder: 1 },
                { minVolume: 2000001, maxVolume: null, rate: 0.21, sortOrder: 2 }
              ]
            }
          },
          { service: "WHATSAPP", component: "MARKETING", rateType: "FLAT", flatRate: 0.85, billingMetric: "PER_UNIT", sortOrder: 2 },
          { service: "WHATSAPP", component: "UTILITY", rateType: "FLAT", flatRate: 0.35, billingMetric: "PER_UNIT", sortOrder: 3 },
          { service: "WHATSAPP", component: "AUTHENTICATION", rateType: "FLAT", flatRate: 0.4, billingMetric: "PER_UNIT", sortOrder: 4 }
        ]
      }
    }
  });

  const approved = await approvePriceRequest(parApproved.id, ceo.id, "Approved — standard rate card for a high-volume customer.");

  const onboarding = await prisma.onboardingChecklist.findUnique({ where: { customerId: approved.customerId }, include: { tasks: true } });
  if (onboarding) {
    const salesTask = onboarding.tasks.find((t) => t.team === "SALES");
    const financeTask = onboarding.tasks.find((t) => t.team === "FINANCE" && t.title.includes("GST"));
    for (const task of [salesTask, financeTask].filter(Boolean) as typeof onboarding.tasks) {
      await prisma.onboardingTask.update({
        where: { id: task.id },
        data: { status: "COMPLETED", completedAt: new Date(), completedById: task.team === "SALES" ? sales.id : finance.id }
      });
    }
    await prisma.onboardingChecklist.update({ where: { id: onboarding.id }, data: { status: "IN_PROGRESS", startedAt: addDays(-3) } });
  }

  const [smsAccount, wabaAccount] = await Promise.all([
    prisma.platformAccount.create({
      data: { customerId: approved.customerId, service: "SMS", externalAccountId: "SMS-ABC123", providerName: "Karix SMS Gateway", adapterKey: "MOCK", status: "ACTIVE" }
    }),
    prisma.platformAccount.create({
      data: { customerId: approved.customerId, service: "WHATSAPP", externalAccountId: "WABA-78945", providerName: "Meta Cloud API", adapterKey: "MOCK", status: "ACTIVE" }
    })
  ]);

  // September 2026 usage for Bright Bazaar Retail, matching the requirements doc's worked billing example exactly:
  // 28,00,000 SMS submitted, 22,00,000 delivered, 1,20,000/80,000/50,000 WhatsApp Marketing/Utility/Authentication.
  const importBatch = await prisma.usageImportBatch.create({
    data: { uploadedById: operations.id, service: "SMS", status: "COMPLETED", rowCount: 11, successCount: 11, errorCount: 0 }
  });
  function spreadOverWeeks(total: number, weeks: number) {
    const base = Math.floor(total / weeks);
    const amounts = Array.from({ length: weeks }, () => base);
    amounts[weeks - 1] += total - base * weeks;
    return amounts;
  }
  const smsSubmittedWeekly = spreadOverWeeks(2800000, 4);
  const smsDeliveredWeekly = spreadOverWeeks(2200000, 4);
  await prisma.usageRecord.createMany({
    data: [
      ...smsSubmittedWeekly.map((quantity, index) => ({
        importBatchId: importBatch.id,
        platformAccountId: smsAccount.id,
        service: "SMS" as const,
        component: "SUBMITTED",
        usageDate: new Date(2026, 8, 7 * index + 5),
        quantity,
        sourceReference: `seed-week-${index + 1}`
      })),
      ...smsDeliveredWeekly.map((quantity, index) => ({
        importBatchId: importBatch.id,
        platformAccountId: smsAccount.id,
        service: "SMS" as const,
        component: "DELIVERED",
        usageDate: new Date(2026, 8, 7 * index + 5),
        quantity,
        sourceReference: `seed-week-${index + 1}`
      })),
      { importBatchId: importBatch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "MARKETING", usageDate: new Date(2026, 8, 15), quantity: 120000, sourceReference: "seed-waba" },
      { importBatchId: importBatch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "UTILITY", usageDate: new Date(2026, 8, 15), quantity: 80000, sourceReference: "seed-waba" },
      { importBatchId: importBatch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "AUTHENTICATION", usageDate: new Date(2026, 8, 15), quantity: 50000, sourceReference: "seed-waba" }
    ]
  });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const currentMonthBatch = await prisma.usageImportBatch.create({
    data: { uploadedById: operations.id, service: "SMS", status: "COMPLETED", rowCount: 4, successCount: 4, errorCount: 0 }
  });
  await prisma.usageRecord.createMany({
    data: [
      { importBatchId: currentMonthBatch.id, platformAccountId: smsAccount.id, service: "SMS", component: "SUBMITTED", usageDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5)), quantity: 1250000, sourceReference: "demo-current-submitted" },
      { importBatchId: currentMonthBatch.id, platformAccountId: smsAccount.id, service: "SMS", component: "DELIVERED", usageDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12)), quantity: 980000, sourceReference: "demo-current-delivered" },
      { importBatchId: currentMonthBatch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "MARKETING", usageDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 4)), quantity: 64000, sourceReference: "demo-current-marketing" },
      { importBatchId: currentMonthBatch.id, platformAccountId: wabaAccount.id, service: "WHATSAPP", component: "UTILITY", usageDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5)), quantity: 42000, sourceReference: "demo-current-utility" }
    ]
  });
  const billingRun = await runBillingForCustomer(approved.customerId, monthStart, monthEnd);
  await getOrCreateReconciliation(billingRun.id);
  const invoice = await finalizeBillingRun(billingRun.id, finance.id);
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: Math.round(Number(invoice.totalAmount) * 0.35 * 100) / 100,
      paidOn: new Date(),
      method: "BANK_TRANSFER",
      reference: "DEMO-NEFT-2026-1042",
      recordedById: finance.id
    }
  });

  const oppPending = await prisma.opportunity.create({
    data: {
      name: "QuickCart Online — Messaging Services",
      companyName: "QuickCart Online",
      contactName: "Rahul Menon",
      contactEmail: "rahul.menon@quickcart.in",
      contactPhone: "+91 9800223344",
      opportunityValue: 450000,
      status: "PROPOSAL",
      expectedStartDate: addDays(15),
      salesOwnerId: sales.id,
      activities: { create: { userId: sales.id, activityType: "OPPORTUNITY_CREATED", description: "Opportunity created by ViH Sales User" } },
      requirements: { create: [{ service: "SMS", expectedMonthlyVolume: 500000, notes: "Order and delivery status updates" }] }
    }
  });

  await prisma.priceApprovalRequest.create({
    data: {
      requestNumber: "PAR-000002",
      opportunityId: oppPending.id,
      requestedById: sales.id,
      status: "RETURNED_FOR_REVISION",
      proposedEffectiveDate: new Date("2026-10-01"),
      setupCost: 10000,
      paymentTerms: "Net 15",
      expectedMonthlyRevenue: 90000,
      expectedMarginPct: 22,
      reason: "New customer, standard SMS-only package.",
      reviewedById: ceo.id,
      reviewedAt: addDays(-2),
      reviewComments: "Delivered rate is too low compared to our rate card — please revise and resubmit.",
      lineItems: {
        create: [
          { service: "SMS", component: "SUBMITTED", rateType: "FLAT", flatRate: 0.18, billingMetric: "PER_UNIT", sortOrder: 0 },
          { service: "SMS", component: "DELIVERED", rateType: "FLAT", flatRate: 0.18, billingMetric: "PER_UNIT", sortOrder: 1 }
        ]
      }
    }
  });

  const parSubmitted = await prisma.priceApprovalRequest.create({
    data: {
      requestNumber: "PAR-000003",
      opportunityId: oppPending.id,
      requestedById: sales.id,
      status: "SUBMITTED",
      proposedEffectiveDate: new Date("2026-10-01"),
      setupCost: 10000,
      paymentTerms: "Net 15",
      expectedMonthlyRevenue: 105000,
      expectedMarginPct: 28,
      reason: "Revised per CEO feedback — delivered rate corrected to standard card.",
      lineItems: {
        create: [
          { service: "SMS", component: "SUBMITTED", rateType: "FLAT", flatRate: 0.18, billingMetric: "PER_UNIT", sortOrder: 0 },
          { service: "SMS", component: "DELIVERED", rateType: "FLAT", flatRate: 0.25, billingMetric: "PER_UNIT", sortOrder: 1 }
        ]
      }
    }
  });
  await prisma.notification.createMany({
    data: [ceo, admin].map((approver) => ({
      userId: approver.id,
      title: "Pricing approval needed",
      message: `${parSubmitted.requestNumber} is waiting for your review.`,
      type: "PRICE_APPROVAL",
      entityType: "PRICE_APPROVAL",
      entityId: parSubmitted.requestNumber
    }))
  });

  await prisma.priceApprovalRequest.create({
    data: {
      requestNumber: "PAR-000004",
      customerId: approved.customerId,
      requestedById: sales.id,
      status: "REJECTED",
      proposedEffectiveDate: new Date("2026-12-01"),
      reason: "Requesting a discounted WhatsApp marketing rate ahead of renewal.",
      reviewedById: ceo.id,
      reviewedAt: addDays(-1),
      reviewComments: "Margin too thin at the proposed rate — revisit after Q4 results.",
      lineItems: { create: [{ service: "WHATSAPP", component: "MARKETING", rateType: "FLAT", flatRate: 0.65, billingMetric: "PER_UNIT", sortOrder: 0 }] }
    }
  });

  const oppQualifying = await prisma.opportunity.create({
    data: {
      name: "Metro Cabs — Messaging Services",
      companyName: "Metro Cabs",
      contactName: "Fatima Sheikh",
      contactEmail: "fatima.sheikh@metrocabs.in",
      contactPhone: "+91 9800334455",
      opportunityValue: 300000,
      status: "QUALIFYING",
      salesOwnerId: sales.id,
      activities: { create: { userId: sales.id, activityType: "OPPORTUNITY_CREATED", description: "Opportunity created by ViH Sales User" } },
      requirements: { create: [{ service: "WHATSAPP", expectedMonthlyVolume: 60000, notes: "Ride confirmations and promos" }] }
    }
  });

  await prisma.priceApprovalRequest.create({
    data: {
      requestNumber: "PAR-000005",
      opportunityId: oppQualifying.id,
      requestedById: sales.id,
      status: "DRAFT",
      proposedEffectiveDate: new Date("2026-11-01"),
      setupCost: 5000,
      reason: "Draft pricing, still confirming volumes with the customer.",
      lineItems: { create: [{ service: "WHATSAPP", component: "UTILITY", rateType: "FLAT", flatRate: 0.35, billingMetric: "PER_UNIT", sortOrder: 0 }] }
    }
  });

  await prisma.opportunity.create({
    data: {
      name: "Sunrise Foods — Messaging Services",
      companyName: "Sunrise Foods",
      contactName: "Devansh Rao",
      contactEmail: "devansh.rao@sunrisefoods.in",
      contactPhone: "+91 9800445566",
      opportunityValue: 180000,
      status: "LOST",
      lostReason: "Budget not approved this quarter",
      salesOwnerId: sales.id,
      activities: {
        create: [
          { userId: sales.id, activityType: "OPPORTUNITY_CREATED", description: "Opportunity created by ViH Sales User" },
          { userId: sales.id, activityType: "STATUS_CHANGED", description: "Status changed from PROPOSAL to LOST" }
        ]
      }
    }
  });

  for (const recipient of [admin, sales, ceo, finance, operations]) {
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        title: "Demo CRM ready",
        message: "Lead pipeline, follow-ups, and action center are populated.",
        type: "SYSTEM"
      }
    });
  }

  console.log("Seeded ViH CRM demo data (leads, tasks, calls, campaigns, 5-role users).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
