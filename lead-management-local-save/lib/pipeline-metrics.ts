export type PipelineOpportunity = {
  status: string;
  opportunityValue: number;
  updatedAt: Date | string;
};

export const OPPORTUNITY_STAGE_PROBABILITY: Record<string, number> = {
  NEW: 10,
  QUALIFYING: 30,
  PROPOSAL: 60,
  WON: 100,
  LOST: 0
};

export function calculatePipelineMetrics(opportunities: PipelineOpportunity[], asOf = new Date()) {
  const openDeals = opportunities.filter((opportunity) => !["WON", "LOST"].includes(opportunity.status));
  const totalValue = openDeals.reduce((sum, opportunity) => sum + Number(opportunity.opportunityValue), 0);
  const weightedValue = openDeals.reduce(
    (sum, opportunity) => sum + Number(opportunity.opportunityValue) * (OPPORTUNITY_STAGE_PROBABILITY[opportunity.status] ?? 0) / 100,
    0
  );
  const stalledCount = openDeals.filter((opportunity) => asOf.getTime() - new Date(opportunity.updatedAt).getTime() >= 14 * 86_400_000).length;

  return {
    openDealCount: openDeals.length,
    totalValue: roundCurrency(totalValue),
    weightedValue: roundCurrency(weightedValue),
    averageDealSize: openDeals.length ? roundCurrency(totalValue / openDeals.length) : 0,
    stalledCount
  };
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}