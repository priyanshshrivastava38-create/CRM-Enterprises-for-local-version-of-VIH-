import { describe, expect, it } from "vitest";
import { calculatePipelineMetrics } from "./pipeline-metrics";

describe("calculatePipelineMetrics", () => {
  it("calculates weighted open pipeline and stalled deals without counting closed deals", () => {
    const asOf = new Date("2026-10-07T12:00:00Z");
    const result = calculatePipelineMetrics([
      { status: "NEW", opportunityValue: 1_000_000, updatedAt: "2026-10-01T12:00:00Z" },
      { status: "PROPOSAL", opportunityValue: 500_000, updatedAt: "2026-09-01T12:00:00Z" },
      { status: "WON", opportunityValue: 300_000, updatedAt: "2026-08-01T12:00:00Z" },
      { status: "LOST", opportunityValue: 200_000, updatedAt: "2026-08-01T12:00:00Z" }
    ], asOf);

    expect(result).toEqual({ openDealCount: 2, totalValue: 1_500_000, weightedValue: 400_000, averageDealSize: 750_000, stalledCount: 1 });
  });
});