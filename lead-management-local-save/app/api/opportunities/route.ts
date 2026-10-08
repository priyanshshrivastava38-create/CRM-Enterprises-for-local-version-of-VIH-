import { NextResponse } from "next/server";
import { Prisma, OpportunityStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunitySchema } from "@/lib/validators";
import { errorResponse } from "@/lib/api-error";

const allowedRoles = ["SALES", "CEO", "ADMIN"];

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const pipelineView = searchParams.get("view") === "pipeline";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(pipelineView ? 10_000 : 100, Math.max(1, Number(searchParams.get("pageSize") ?? (pipelineView ? 10_000 : 25)) || 25));

  if (status && status !== "ALL" && !(Object.values(OpportunityStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const where: Prisma.OpportunityWhereInput = {
    deletedAt: null,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }, { contactEmail: { contains: q, mode: "insensitive" } }] } : {}),
    ...(status && status !== "ALL" ? { status: status as OpportunityStatus } : {})
  };
  if (user.role === "SALES") where.salesOwnerId = user.id;
  const stalledCutoff = new Date(Date.now() - 14 * 86_400_000);

  const [opportunities, total, stageGroups, openPipeline, stalledCount] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { salesOwner: { select: { id: true, name: true } }, requirements: true, customer: { select: { id: true, customerCode: true } } },
      orderBy: { updatedAt: "desc" },
      skip: pipelineView ? 0 : (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.opportunity.count({ where }),
    prisma.opportunity.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { opportunityValue: true } }),
    prisma.opportunity.aggregate({
      where: { ...where, status: { notIn: ["WON", "LOST"] } },
      _count: { _all: true },
      _sum: { opportunityValue: true },
      _avg: { opportunityValue: true }
    }),
    prisma.opportunity.count({ where: { ...where, status: { notIn: ["WON", "LOST"] }, updatedAt: { lte: stalledCutoff } } })
  ]);

  return NextResponse.json({
    opportunities,
    pipeline: {
      stages: Object.fromEntries(stageGroups.map((group) => [group.status, { count: group._count._all, value: Number(group._sum.opportunityValue ?? 0) }])),
      openDealCount: openPipeline._count._all,
      totalValue: Number(openPipeline._sum.opportunityValue ?? 0),
      averageDealSize: Number(openPipeline._avg.opportunityValue ?? 0),
      stalledCount
    },
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SALES" && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = opportunitySchema.parse(await request.json());
    const opportunity = await prisma.opportunity.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        billingAddress: input.billingAddress,
        gstNumber: input.gstNumber,
        expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : null,
        opportunityValue: input.opportunityValue,
        salesOwnerId: input.salesOwnerId,
        leadId: input.leadId || null,
        requirements: { create: input.requirements },
        activities: { create: { userId: user.id, activityType: "OPPORTUNITY_CREATED", description: `Opportunity created by ${user.name}` } }
      },
      include: { salesOwner: { select: { id: true, name: true } }, requirements: true }
    });
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
