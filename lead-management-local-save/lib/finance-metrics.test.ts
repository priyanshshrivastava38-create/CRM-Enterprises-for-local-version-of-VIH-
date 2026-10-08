import { describe, expect, it } from "vitest";
import { calculateReceivables } from "./finance-metrics";

describe("calculateReceivables", () => {
  const asOf = new Date("2026-10-07T12:00:00Z");

  it("subtracts partial payments before calculating overdue and aging balances", () => {
    const metrics = calculateReceivables([
      { totalAmount: 1000, dueDate: "2026-09-20T00:00:00Z", status: "ISSUED", payments: [{ amount: 250 }] },
      { totalAmount: 400, dueDate: "2026-10-20T00:00:00Z", status: "ISSUED", payments: [] }
    ], asOf);

    expect(metrics).toEqual({
      outstandingAmount: 1150,
      overdueAmount: 750,
      openInvoiceCount: 2,
      overdueInvoiceCount: 1,
      aging: { current: 400, days1To30: 750, days31To60: 0, days61To90: 0, days90Plus: 0 }
    });
  });

  it("excludes settled and cancelled invoices and puts older debt in the correct bucket", () => {
    const metrics = calculateReceivables([
      { totalAmount: 800, dueDate: "2026-10-01T00:00:00Z", status: "ISSUED", payments: [{ amount: 800 }] },
      { totalAmount: 200, dueDate: "2026-06-01T00:00:00Z", status: "ISSUED", payments: [] },
      { totalAmount: 500, dueDate: "2026-06-01T00:00:00Z", status: "CANCELLED", payments: [] }
    ], asOf);

    expect(metrics.outstandingAmount).toBe(200);
    expect(metrics.overdueAmount).toBe(200);
    expect(metrics.openInvoiceCount).toBe(1);
    expect(metrics.overdueInvoiceCount).toBe(1);
    expect(metrics.aging.days90Plus).toBe(200);
  });
});