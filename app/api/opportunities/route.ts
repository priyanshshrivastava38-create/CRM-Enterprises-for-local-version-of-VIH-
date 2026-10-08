import { NextResponse } from "next/server";
import { Prisma, OpportunityStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunitySchema } from "@/lib/validators";
import { errorResponse } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

const allowedRoles = ["SALES", "CEO", "ADMIN"];

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25));

  if (status && status !== "ALL" && !(Object.values(OpportunityStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const where: Prisma.OpportunityWhereInput = {
    deletedAt: null,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }, { contactEmail: { contains: q, mode: "insensitive" } }] } : {}),
    ...(status && status !== "ALL" ? { status: status as OpportunityStatus } : {})
  };
  if (user.role === "SALES") where.salesOwnerId = user.id;

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { salesOwner: { select: { id: true, name: true } }, requirements: true, customer: { select: { id: true, customerCode: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.opportunity.count({ where })
  ]);

  return NextResponse.json({ opportunities, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
