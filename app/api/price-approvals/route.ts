import { NextResponse } from "next/server";
import { Prisma, PriceApprovalStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { priceApprovalRequestSchema } from "@/lib/validators";
import { errorResponse, ApiError } from "@/lib/api-error";
import { nextRequestNumber } from "@/lib/numbering";
import { canManageDeals } from "@/lib/rbac";

const allowedRoles = ["SALES", "CEO", "FINANCE", "ADMIN"];

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25));

  if (status && status !== "ALL" && !(Object.values(PriceApprovalStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const where: Prisma.PriceApprovalRequestWhereInput = {
    ...(status && status !== "ALL" ? { status: status as PriceApprovalStatus } : {})
  };
  if (user.role === "SALES") where.requestedById = user.id;

  const [requests, total] = await Promise.all([
    prisma.priceApprovalRequest.findMany({
      where,
      include: {
        opportunity: { select: { id: true, name: true, companyName: true } },
        customer: { select: { id: true, customerCode: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        lineItems: { include: { slabs: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.priceApprovalRequest.count({ where })
  ]);

  return NextResponse.json({ requests, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = priceApprovalRequestSchema.parse(await request.json());

    if (input.opportunityId) {
      const opportunity = await prisma.opportunity.findFirst({ where: { id: input.opportunityId, deletedAt: null } });
      if (!opportunity) throw new ApiError("Opportunity not found", 404);
      if (user.role === "SALES" && opportunity.salesOwnerId !== user.id) throw new ApiError("Forbidden", 403);
    }

    const created = await prisma.$transaction(async (tx) => {
      const requestNumber = await nextRequestNumber(tx);
      return tx.priceApprovalRequest.create({
        data: {
          requestNumber,
          opportunityId: input.opportunityId || null,
          customerId: input.customerId || null,
          requestedById: user.id,
          status: "DRAFT",
          proposedEffectiveDate: new Date(input.proposedEffectiveDate),
          setupCost: input.setupCost,
          paymentTerms: input.paymentTerms,
          commercialTerms: input.commercialTerms,
          expectedMonthlyRevenue: input.expectedMonthlyRevenue,
          expectedMarginPct: input.expectedMarginPct,
          reason: input.reason,
          lineItems: {
            create: input.lineItems.map((li, index) => ({
              service: li.service,
              component: li.component,
              rateType: li.rateType,
              flatRate: li.flatRate,
              expectedVolume: li.expectedVolume,
              billingMetric: li.billingMetric,
              sortOrder: index,
              slabs: { create: li.slabs.map((slab, slabIndex) => ({ ...slab, sortOrder: slabIndex })) }
            }))
          }
        },
        include: { lineItems: { include: { slabs: true } } }
      });
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
