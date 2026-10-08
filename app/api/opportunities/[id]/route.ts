import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunitySchema } from "@/lib/validators";
import { errorResponse, ApiError } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

const allowedRoles = ["SALES", "CEO", "ADMIN"];

async function opportunityWithDetail(id: string) {
  return prisma.opportunity.findFirst({
    where: { id, deletedAt: null },
    include: {
      salesOwner: { select: { id: true, name: true } },
      requirements: true,
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { id: true, name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } },
      priceApprovals: { orderBy: { createdAt: "desc" } },
      customer: { select: { id: true, customerCode: true, status: true } },
      lead: { select: { id: true, firstName: true, lastName: true } }
    }
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const opportunity = await opportunityWithDetail(id);
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && opportunity.salesOwnerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ opportunity });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const current = await prisma.opportunity.findFirst({ where: { id, deletedAt: null } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && current.salesOwnerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (current.status === "WON") throw new ApiError("A won opportunity cannot be edited", 409);

    const input = opportunitySchema.partial().parse(await request.json());
    await prisma.opportunity.update({
      where: { id },
      data: {
        ...input,
        expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : input.expectedStartDate === null ? null : undefined,
        requirements: input.requirements
          ? { deleteMany: {}, create: input.requirements }
          : undefined,
        activities: { create: { userId: user.id, activityType: "OPPORTUNITY_UPDATED", description: "Opportunity details updated" } }
      }
    });

    const opportunity = await opportunityWithDetail(id);
    return NextResponse.json({ opportunity });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.opportunity.findFirst({ where: { id, deletedAt: null } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && current.salesOwnerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (current.status === "WON") return NextResponse.json({ error: "A won opportunity cannot be deleted" }, { status: 409 });

  await prisma.opportunity.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
