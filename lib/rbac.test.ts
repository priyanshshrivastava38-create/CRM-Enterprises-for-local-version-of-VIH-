import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { canApprovePricing, canManageDeals } from "./rbac";

const as = (role: string) => ({ id: "u1", role: role as Role });

describe("deal permissions", () => {
  it("lets sales, sales leaders, the CEO, and admins create deals and price requests", () => {
    for (const role of ["SALES", "REGIONAL_SALES_HEAD", "CSO", "CEO", "ADMIN"]) expect(canManageDeals(as(role))).toBe(true);
  });

  it("keeps finance, operations, and tech out of deal creation", () => {
    for (const role of ["FINANCE", "CFO", "OPERATIONS", "CTO"]) expect(canManageDeals(as(role))).toBe(false);
  });

  it("leaves pricing approval with the CEO and admins", () => {
    expect(canApprovePricing(as("CEO"))).toBe(true);
    expect(canApprovePricing(as("SALES"))).toBe(false);
  });
});
