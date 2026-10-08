import { NextResponse } from "next/server";
import { LeadStatus, Prisma, Priority } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore, priorityFromScore } from "@/lib/scoring";
import { leadSchema } from "@/lib/validators";
import { errorResponse } from "@/lib/api-error";
import { rankSalesAgents } from "@/lib/assignment";

function normalizeLeadInput(body: unknown) {
  const data = leadSchema.parse(body);
  const scoreResult = calculateLeadScore({
    ...data,
    status: data.status as LeadStatus | undefined,
    priority: data.priority as Priority | undefined
  });
  return {
    ...data,
    status: (data.status ?? "NEW") as LeadStatus,
    priority: (data.priority ?? priorityFromScore(scoreResult.score)) as Priority,
    score: scoreResult.score,
    nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
    assignedTo: data.assignedTo || null,
    campaignId: data.campaignId || null
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const priority = searchParams.get("priority");
  const assignedTo = searchParams.get("assignedTo");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 25) || 25));

  if (status && status !== "ALL" && !(Object.values(LeadStatus) as string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  if (priority && priority !== "ALL" && !(Object.values(Priority) as string[]).includes(priority)) {
    return NextResponse.json({ error: "Invalid priority filter" }, { status: 400 });
  }

  const where: Prisma.LeadWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(status && status !== "ALL" ? { status: status as LeadStatus } : {}),
    ...(source && source !== "ALL" ? { source } : {}),
    ...(priority && priority !== "ALL" ? { priority: priority as Priority } : {}),
    ...(assignedTo && assignedTo !== "ALL" ? { assignedTo } : {})
  };

  if (user.role === "SALES") where.assignedTo = user.id;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignedUser: { select: { id: true, name: true } }, campaign: true },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.lead.count({ where })
  ]);

  return NextResponse.json({ leads, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = normalizeLeadInput(await request.json());

    const existing = await prisma.lead.findFirst({
      where: { deletedAt: null, OR: [{ email: input.email }, { phone: input.phone }] },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true }
    });
    if (existing) {
      return NextResponse.json({ error: "A lead with this email or phone already exists", lead: existing }, { status: 409 });
    }

    let assignedTo = user.role === "SALES" ? user.id : input.assignedTo || null;
    if (!assignedTo) {
      const salesAgents = await prisma.user.findMany({
        where: { role: "SALES", active: true },
        select: { id: true }
      });

      if (salesAgents.length > 0) {
        const workload = await Promise.all(
          salesAgents.map(async (agent) => {
            const [openLeads, overdueTasks, activeDeals] = await Promise.all([
              prisma.lead.count({ where: { assignedTo: agent.id, deletedAt: null, status: { notIn: ["CONVERTED", "LOST", "INVALID"] } } }),
              prisma.task.count({ where: { assignedTo: agent.id, deletedAt: null, status: "OPEN", dueDate: { lt: new Date() } } }),
              prisma.opportunity.count({ where: { salesOwnerId: agent.id, deletedAt: null, status: { notIn: ["WON", "LOST"] } } })
            ]);

            return { id: agent.id, openLeads, overdueTasks, activeDeals };
          })
        );

        const chosen = rankSalesAgents(workload, input.priority ?? "WARM")[0];
        assignedTo = chosen?.id ?? null;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        ...input,
        assignedTo,
        activities: {
          create: {
            userId: user.id,
            activityType: "LEAD_CREATED",
            description: `Lead created by ${user.name}`,
            metadata: { score: input.score, assignedTo }
          }
        }
      },
      include: { assignedUser: { select: { id: true, name: true } }, campaign: true }
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
