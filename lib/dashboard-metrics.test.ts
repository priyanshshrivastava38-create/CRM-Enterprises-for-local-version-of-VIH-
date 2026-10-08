import { describe, expect, it } from "vitest";
import { agingBuckets, growthPct, lastMonths, pipelineForecast, sumByMonth } from "./dashboard-metrics";

describe("lastMonths", () => {
  it("returns oldest-first months ending at the given month, across a year boundary", () => {
    const months = lastMonths("2026-02", 4);
    expect(months.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(months[0].label).toBe("Nov 25");
    expect(months[3].end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });
});

describe("sumByMonth", () => {
  it("adds amounts into the matching month and ignores rows outside the window", () => {
    const months = lastMonths("2026-10", 2);
    const totals = sumByMonth(
      [
        { date: new Date("2026-09-15T00:00:00Z"), amount: 100 },
        { date: new Date("2026-10-01T00:00:00Z"), amount: 50 },
        { date: new Date("2026-10-31T23:59:59Z"), amount: 25 },
        { date: new Date("2026-08-31T00:00:00Z"), amount: 999 }
      ],
      months
    );
    expect(totals).toEqual([100, 75]);
  });
});

describe("agingBuckets", () => {
  it("buckets open balances by days past due and skips settled invoices", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);
    const buckets = agingBuckets(
      [
        { dueDate: day(5), balance: 10 },
        { dueDate: day(-10), balance: 20 },
        { dueDate: day(-45), balance: 30 },
        { dueDate: day(-75), balance: 40 },
        { dueDate: day(-120), balance: 50 },
        { dueDate: day(-120), balance: 0 }
      ],
      now
    );
    expect(buckets.map((b) => b.amount)).toEqual([10, 20, 30, 40, 50]);
    expect(buckets[4].count).toBe(1);
  });
});

describe("growthPct", () => {
  it("returns null without a baseline and a one-decimal percentage otherwise", () => {
    expect(growthPct(100, 0)).toBeNull();
    expect(growthPct(150, 120)).toBe(25);
    expect(growthPct(90, 120)).toBe(-25);
  });
});

describe("pipelineForecast", () => {
  it("weights open deals by stage probability and ignores won and lost deals", () => {
    const result = pipelineForecast([
      { status: "NEW", value: 100000 },
      { status: "PROPOSAL", value: 200000 },
      { status: "WON", value: 999999 },
      { status: "LOST", value: 50000 }
    ]);
    expect(result).toEqual({ openValue: 300000, weightedValue: 130000 });
  });
});
