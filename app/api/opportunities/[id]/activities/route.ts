import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

const noteSchema = z.object({ description: z.string().min(1) });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const activities = await prisma.activity.findMany({ where: { opportunityId: id }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } });
  return NextResponse.json({ activities });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDeals(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const opportunity = await prisma.opportunity.findFirst({ where: { id, deletedAt: null } });
    if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role === "SALES" && opportunity.salesOwnerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const input = noteSchema.parse(await request.json());
    const activity = await prisma.activity.create({
      data: { opportunityId: id, userId: user.id, activityType: "NOTE", description: input.description },
      include: { user: { select: { id: true, name: true } } }
    });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
