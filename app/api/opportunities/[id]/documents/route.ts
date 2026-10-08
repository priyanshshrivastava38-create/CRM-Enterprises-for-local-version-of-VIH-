import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opportunityDocumentSchema } from "@/lib/validators";
import { errorResponse } from "@/lib/api-error";
import { canManageDeals } from "@/lib/rbac";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const documents = await prisma.opportunityDocument.findMany({ where: { opportunityId: id }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { id: true, name: true } } } });
  return NextResponse.json({ documents });
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

    const input = opportunityDocumentSchema.parse(await request.json());
    const document = await prisma.opportunityDocument.create({
      data: { opportunityId: id, title: input.title, url: input.url, uploadedById: user.id },
      include: { uploadedBy: { select: { id: true, name: true } } }
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
