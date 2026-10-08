import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pct } from "@/lib/format";
import { lastMonths, sumByMonth } from "@/lib/dashboard-metrics";

const statuses = ["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "FOLLOW_UP", "CONVERTED", "LOST"];
const priorities = ["HOT", "WARM", "COLD"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leadWhere = { deletedAt: null, ...(user.role === "SALES" ? { assignedTo: user.id } : {}) };
  const taskScope = user.role === "SALES" ? { assignedTo: user.id } : {};
  const today = new Date();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const months = lastMonths(today.toISOString().slice(0, 7), 6);

  const [
    total,
    hot,
    converted,
    statusCounts,
    sourceCounts,
    priorityCounts,
    agents,
    agentStatusCounts,
    agentContactedCounts,
    tasks,
    overdue,
    hotUncontacted,
    stale,
    leadsInWindow
  ] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({ where: { ...leadWhere, priority: "HOT" } }),
    prisma.lead.count({ where: { ...leadWhere, status: "CONVERTED" } }),
    prisma.lead.groupBy({ by: ["status"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["priority"], where: leadWhere, _count: { _all: true } }),
    prisma.user.findMany({ where: { role: "SALES", active: true }, select: { id: true, name: true } }),
    prisma.lead.groupBy({ by: ["assignedTo", "status"], where: { ...leadWhere, assignedTo: { not: null } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["assignedTo"], where: { ...leadWhere, assignedTo: { not: null }, lastContactedAt: { not: null } }, _count: { _all: true } }),
    prisma.task.findMany({
      where: { ...taskScope, deletedAt: null, status: "OPEN", dueDate: { lte: endOfDay(today) } },
      include: { lead: true, assignedUser: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10
    }),
    prisma.task.count({ where: { ...taskScope, deletedAt: null, status: "OPEN", dueDate: { lt: startOfDay(today) } } }),
    prisma.lead.findFirst({ where: { ...leadWhere, priority: "HOT", lastContactedAt: null } }),
    prisma.lead.findFirst({ where: { ...leadWhere, status: "NEW", createdAt: { lt: fortyEightHoursAgo } } }),
    prisma.lead.findMany({ where: { ...leadWhere, createdAt: { gte: months[0].start } }, select: { createdAt: true, status: true } })
  ]);

  // Monthly cohorts: leads created in each month, and how many of that cohort have since converted.
  const createdTrend = sumByMonth(leadsInWindow.map((lead) => ({ date: lead.createdAt, amount: 1 })), months);
  const convertedTrend = sumByMonth(leadsInWindow.map((lead) => ({ date: lead.createdAt, amount: lead.status === "CONVERTED" ? 1 : 0 })), months);

  const statusCountMap = new Map(statusCounts.map((row) => [row.status as string, row._count._all]));
  const byStatus = statuses.map((status) => ({ name: status.replace("_", " "), value: statusCountMap.get(status) ?? 0 }));
  const bySource = sourceCounts.map((row) => ({ name: row.source, value: row._count._all }));
  const priorityCountMap = new Map(priorityCounts.map((row) => [row.priority as string, row._count._all]));
  const byPriority = priorities.map((priority) => ({ name: priority, value: priorityCountMap.get(priority) ?? 0 }));

  const agentAssignedMap = new Map<string, number>();
  const agentQualifiedMap = new Map<string, number>();
  const agentConvertedMap = new Map<string, number>();
  for (const row of agentStatusCounts) {
    const agentId = row.assignedTo as string;
    agentAssignedMap.set(agentId, (agentAssignedMap.get(agentId) ?? 0) + row._count._all);
    if (["QUALIFIED", "INTERESTED", "CONVERTED"].includes(row.status)) {
      agentQualifiedMap.set(agentId, (agentQualifiedMap.get(agentId) ?? 0) + row._count._all);
    }
    if (row.status === "CONVERTED") {
      agentConvertedMap.set(agentId, (agentConvertedMap.get(agentId) ?? 0) + row._count._all);
    }
  }
  const agentContactedMap = new Map(agentContactedCounts.map((row) => [row.assignedTo as string, row._count._all]));

  const agentPerformance = agents.map((agent) => {
    const assigned = agentAssignedMap.get(agent.id) ?? 0;
    const agentConverted = agentConvertedMap.get(agent.id) ?? 0;
    return {
      name: agent.name,
      assigned,
      contacted: agentContactedMap.get(agent.id) ?? 0,
      qualified: agentQualifiedMap.get(agent.id) ?? 0,
      converted: agentConverted,
      conversionRate: pct(agentConverted, assigned)
    };
  });

  const actions = [
    hotUncontacted && { type: "Call Hot Lead", message: `${hotUncontacted.firstName} ${hotUncontacted.lastName} has a score of ${hotUncontacted.score}.`, leadId: hotUncontacted.id },
    tasks[0] && { type: "Follow Up", message: `${tasks[0].title} is due ${tasks[0].lead ? `for ${tasks[0].lead.firstName}` : "today"}.`, leadId: tasks[0].leadId },
    overdue > 0 && { type: "Overdue", message: `${overdue} open follow-up tasks are overdue.`, leadId: null },
    stale && { type: "Reassign", message: `${stale.firstName} has remained new for more than 48 hours.`, leadId: stale.id }
  ].filter(Boolean);

  return NextResponse.json({
    kpis: {
      total,
      newLeads: statusCountMap.get("NEW") ?? 0,
      contacted: statusCountMap.get("CONTACTED") ?? 0,
      qualified: statusCountMap.get("QUALIFIED") ?? 0,
      hot,
      followUpsDue: tasks.length,
      converted,
      conversionRate: pct(converted, total),
      overdueTasks: overdue
    },
    trend: months.map((month, index) => ({ month: month.key, label: month.label, created: createdTrend[index], converted: convertedTrend[index] })),
    byStatus,
    bySource,
    byPriority,
    funnel: byStatus,
    agentPerformance,
    todayTasks: tasks,
    actions
  });
}
