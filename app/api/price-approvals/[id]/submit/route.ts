import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, ApiError } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const current = await prisma.priceApprovalRequest.findUnique({ where: { id }, include: { lineItems: true } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && current.requestedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!["DRAFT", "RETURNED_FOR_REVISION"].includes(current.status)) throw new ApiError("Only a draft or returned request can be submitted", 409);
    if (current.lineItems.length === 0) throw new ApiError("Add at least one service line item before submitting", 400);

    const updated = await prisma.$transaction(async (tx) => {
      const request_ = await tx.priceApprovalRequest.update({
        where: { id },
        data: { status: "SUBMITTED", reviewComments: null, reviewedById: null, reviewedAt: null }
      });
      const approvers = await tx.user.findMany({ where: { role: { in: ["CEO", "ADMIN"] }, active: true }, select: { id: true } });
      await tx.notification.createMany({
        data: approvers.map((approver) => ({
          userId: approver.id,
          title: "Pricing approval needed",
          message: `${request_.requestNumber} is waiting for your review.`,
          type: "PRICE_APPROVAL",
          entityType: "PRICE_APPROVAL",
          entityId: request_.requestNumber
        }))
      });
      return request_;
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
