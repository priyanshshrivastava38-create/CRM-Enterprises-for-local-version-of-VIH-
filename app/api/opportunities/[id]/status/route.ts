import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunityStatusSchema } from "@/lib/validators";
import { errorResponse, ApiError } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const current = await prisma.opportunity.findFirst({ where: { id, deletedAt: null } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && current.salesOwnerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (current.status === "WON") throw new ApiError("A won opportunity's status cannot be changed here", 409);

    const input = opportunityStatusSchema.parse(await request.json());
    if (input.status === "WON") throw new ApiError("An opportunity can only be marked Won by approving its pricing request", 400);

    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        status: input.status,
        lostReason: input.status === "LOST" ? input.lostReason : null,
        activities: {
          create: { userId: user.id, activityType: "STATUS_CHANGED", description: `Status changed from ${current.status} to ${input.status}` }
        }
      }
    });

    return NextResponse.json({ opportunity });
  } catch (error) {
    return errorResponse(error);
  }
}
