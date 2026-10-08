import { NextResponse } from "next/server";
import { Prisma, ServiceType } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, ApiError } from "@/lib/api-error";
import { z } from "zod";

const allowedRoles = ["OPERATIONS", "FINANCE", "ADMIN"];
const manualUsageSchema = z.object({
  platformAccountId: z.string().min(1),
  usageDate: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid usage date"),
  component: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().int().positive().max(2_147_483_647),
  sourceReference: z.string().trim().max(200).optional().nullable()
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const platformAccountId = searchParams.get("platformAccountId");
  const service = searchParams.get("service");
  const component = searchParams.get("component");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50) || 50));

  if (service && !(Object.values(ServiceType) as string[]).includes(service)) {
    return NextResponse.json({ error: "Invalid service filter" }, { status: 400 });
  }

  const where: Prisma.UsageRecordWhereInput = {
    ...(platformAccountId ? { platformAccountId } : {}),
    ...(service ? { service: service as ServiceType } : {}),
    ...(component ? { component } : {}),
    ...(customerId ? { platformAccount: { customerId } } : {})
  };

  const [records, total] = await Promise.all([
    prisma.usageRecord.findMany({
      where,
      include: { platformAccount: { include: { customer: { select: { id: true, customerCode: true, name: true } } } } },
      orderBy: { usageDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.usageRecord.count({ where })
  ]);

  return NextResponse.json({ records, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedRoles.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = manualUsageSchema.parse(await request.json());
    const account = await prisma.platformAccount.findUnique({ where: { id: input.platformAccountId } });
    if (!account) throw new ApiError("Platform account not found", 404);

    const { batch, record } = await prisma.$transaction(async (tx) => {
      const batch = await tx.usageImportBatch.create({
        data: {
          uploadedById: user.id,
          fileName: "Manual entry",
          service: account.service,
          status: "COMPLETED",
          rowCount: 1,
          successCount: 1,
          errorCount: 0
        }
      });
      const record = await tx.usageRecord.create({
        data: {
          importBatchId: batch.id,
          platformAccountId: account.id,
          service: account.service,
          usageDate: new Date(input.usageDate),
          component: input.component,
          quantity: input.quantity,
          sourceReference: input.sourceReference?.trim() || null,
          rawPayload: { source: "manual" }
        },
        include: { platformAccount: { include: { customer: { select: { id: true, customerCode: true, name: true } } } } }
      });
      return { batch, record };
    });

    return NextResponse.json({ batch, record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
