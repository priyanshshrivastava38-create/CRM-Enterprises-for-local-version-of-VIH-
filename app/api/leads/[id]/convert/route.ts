import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunityRequirementSchema } from "@/lib/validators";
import { errorResponse, ApiError } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

const convertSchema = z.object({
  opportunityValue: z.coerce.number().min(0),
  expectedStartDate: z.string().optional().nullable(),
  requirements: z.array(opportunityRequirementSchema).optional().default([])
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && lead.assignedTo !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.opportunity.findUnique({ where: { leadId: id } });
    if (existing) throw new ApiError("This lead has already been converted to an opportunity", 409);

    const input = convertSchema.parse(await request.json());

    const opportunity = await prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          leadId: lead.id,
          name: `${lead.company} — Messaging Services`,
          companyName: lead.company,
          contactName: `${lead.firstName} ${lead.lastName}`,
          contactEmail: lead.email,
          contactPhone: lead.phone,
          opportunityValue: input.opportunityValue,
          expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : null,
          salesOwnerId: lead.assignedTo ?? user.id,
          requirements: { create: input.requirements },
          activities: {
            create: { userId: user.id, activityType: "OPPORTUNITY_CREATED", description: `Converted from lead ${lead.firstName} ${lead.lastName}` }
          }
        }
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          activities: { create: { userId: user.id, activityType: "CONVERTED_TO_OPPORTUNITY", description: "Lead converted to an opportunity" } }
        }
      });
      return created;
    });

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
