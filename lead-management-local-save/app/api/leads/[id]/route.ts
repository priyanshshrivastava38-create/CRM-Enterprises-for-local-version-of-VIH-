import { LeadStatus, Prisma, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeLead } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore, priorityFromScore } from "@/lib/scoring";
import { leadSchema } from "@/lib/validators";
import { errorResponse } from "@/lib/api-error";
import { rankSalesAgents } from "@/lib/assignment";

async function leadWithHistory(id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignedUser: { select: { id: true, name: true, role: true } },
      campaign: true,
      tasks: { orderBy: { dueDate: "asc" }, include: { assignedUser: { select: { id: true, name: true } } } },
      calls: { orderBy: { createdAt: "desc" }, include: { agent: { select: { id: true, name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } }
    }
  });
  if (!lead) return null;
  const scoreMeta = calculateLeadScore({
    status: lead.status,
    priority: lead.priority,
    notes: lead.notes,
    source: lead.source,
    email: lead.email,
    phone: lead.phone,
    calls: lead.calls,
    taskCompletedCount: lead.tasks.filter((task) => task.status === "COMPLETED").length
  });
  return { ...lead, scoreMeta, ai: analyzeLead(lead) };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const lead = await leadWithHistory(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && lead.assignedTo !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ lead });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const current = await prisma.lead.findUnique({ where: { id }, include: { calls: true, tasks: true } });
  if (!current || current.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "SALES" && current.assignedTo !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const patch = await request.json();
    const parsed = leadSchema.partial().parse(patch);
    const scoreResult = calculateLeadScore({
      ...current,
      ...parsed,
      status: (parsed.status as LeadStatus | undefined) ?? current.status,
      priority: (parsed.priority as Priority | undefined) ?? current.priority,
      calls: current.calls,
      taskCompletedCount: current.tasks.filter((task) => task.status === "COMPLETED").length
    });
    let assignedTo = parsed.assignedTo === "" ? null : parsed.assignedTo ?? current.assignedTo;

    if (!assignedTo && current.assignedTo == null && current.status !== "CONVERTED") {
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

        assignedTo = rankSalesAgents(workload, (parsed.priority ?? current.priority ?? "WARM") as "HOT" | "WARM" | "COLD")[0]?.id ?? null;
      }
    }

    const data: Prisma.LeadUncheckedUpdateInput = {
      ...parsed,
      nextFollowUpAt: parsed.nextFollowUpAt ? new Date(parsed.nextFollowUpAt) : parsed.nextFollowUpAt === null ? null : undefined,
      assignedTo,
      campaignId: parsed.campaignId === "" ? null : parsed.campaignId,
      score: scoreResult.score,
      priority: (parsed.priority ?? priorityFromScore(scoreResult.score)) as Priority
    };

    const activityType = patch.status && patch.status !== current.status ? "STATUS_CHANGED" : patch.assignedTo ? "ASSIGNED" : "LEAD_UPDATED";
    const description =
      activityType === "STATUS_CHANGED"
        ? `Status changed from ${current.status} to ${patch.status}`
        : activityType === "ASSIGNED"
          ? "Lead assignment updated"
          : "Lead details updated";

    await prisma.lead.update({
      where: { id },
      data: {
        ...data,
        lastContactedAt: patch.status === "CONTACTED" ? new Date() : undefined,
        activities: {
          create: {
            userId: user.id,
            activityType,
            description,
            metadata: { score: scoreResult.score, reasons: scoreResult.reasons }
          }
        }
      }
    });

    const lead = await leadWithHistory(id);
    return NextResponse.json({ lead });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role === "SALES") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const current = await prisma.lead.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!current || current.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
