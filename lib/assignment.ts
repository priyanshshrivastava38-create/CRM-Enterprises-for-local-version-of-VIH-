export type SalesAgentLoad = {
  id: string;
  openLeads: number;
  overdueTasks: number;
  activeDeals: number;
};

export type SalesAgentWorkload = Omit<SalesAgentLoad, "id">;

export type AssignmentPriority = "HOT" | "WARM" | "COLD";

export function calculateWorkloadScore(agent: SalesAgentWorkload, leadPriority: AssignmentPriority = "WARM") {
  const leadWeight = leadPriority === "HOT" ? 1.8 : leadPriority === "WARM" ? 1.35 : 1;
  const overdueWeight = leadPriority === "HOT" ? 2.7 : leadPriority === "WARM" ? 2.2 : 1.7;
  const dealWeight = leadPriority === "HOT" ? 1.1 : leadPriority === "WARM" ? 0.85 : 0.7;

  return agent.openLeads * leadWeight + agent.overdueTasks * overdueWeight + agent.activeDeals * dealWeight;
}

export function rankSalesAgents(agents: SalesAgentLoad[], leadPriority: AssignmentPriority = "WARM") {
  return [...agents].sort((a, b) => {
    const scoreDelta = calculateWorkloadScore(a, leadPriority) - calculateWorkloadScore(b, leadPriority);
    if (Math.abs(scoreDelta) > 0.000001) return scoreDelta;

    const totalDelta = (a.openLeads + a.overdueTasks + a.activeDeals) - (b.openLeads + b.overdueTasks + b.activeDeals);
    if (totalDelta !== 0) return totalDelta;

    return a.id.localeCompare(b.id);
  });
}
