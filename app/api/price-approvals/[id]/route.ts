import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { priceApprovalRequestSchema } from "@/lib/validators";
import { errorResponse, ApiError } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

const allowedRoles = ["SALES", "CEO", "FINANCE", "ADMIN"];
const editableStatuses = ["DRAFT", "RETURNED_FOR_REVISION"];

async function requestWithDetail(id: string) {
  return prisma.priceApprovalRequest.findUnique({
    where: { id },
    include: {
      opportunity: true,
      customer: true,
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      lineItems: { include: { slabs: true }, orderBy: { sortOrder: "asc" } },
      ratePlan: true
    }
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const request_ = await requestWithDetail(id);
  if (!request_) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && request_.requestedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ request: request_ });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const current = await prisma.priceApprovalRequest.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && current.requestedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!editableStatuses.includes(current.status)) throw new ApiError("Only a draft or returned request can be edited", 409);

    const input = priceApprovalRequestSchema.parse(await request.json());

    await prisma.$transaction(async (tx) => {
      await tx.priceApprovalLineItem.deleteMany({ where: { requestId: id } });
      await tx.priceApprovalRequest.update({
        where: { id },
        data: {
          opportunityId: input.opportunityId || null,
          customerId: input.customerId || null,
          proposedEffectiveDate: new Date(input.proposedEffectiveDate),
          setupCost: input.setupCost,
          paymentTerms: input.paymentTerms,
          commercialTerms: input.commercialTerms,
          expectedMonthlyRevenue: input.expectedMonthlyRevenue,
          expectedMarginPct: input.expectedMarginPct,
          reason: input.reason,
          status: current.status === "RETURNED_FOR_REVISION" ? "DRAFT" : current.status,
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
        }
      });
    });

    const updated = await requestWithDetail(id);
    return NextResponse.json({ request: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.priceApprovalRequest.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && current.requestedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (current.status !== "DRAFT") return NextResponse.json({ error: "Only a draft request can be deleted" }, { status: 409 });

  await prisma.priceApprovalRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
