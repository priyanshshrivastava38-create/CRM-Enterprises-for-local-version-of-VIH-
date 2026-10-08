import { describe, expect, it } from "vitest";
import { normalizeEmail, verifyPassword, hashPassword, DEMO_PASSWORD } from "./auth";
import { DEMO_ACCOUNTS } from "./demo-accounts";

describe("auth helpers", () => {
  it("trims whitespace and lowercases addresses before auth checks", () => {
    expect(normalizeEmail(" VIH.SALES@VIH.DEMO ")).toBe("vih.sales@vih.demo");
  });

  it("verifies matching password hashes correctly", async () => {
    const hash = await hashPassword("Secret123!");
    const valid = await verifyPassword("Secret123!", hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("WrongPassword", hash);
    expect(invalid).toBe(false);
  });

  it("never accepts the demo password against another account's hash", async () => {
    const hash = await hashPassword("random-seeded-hash");
    expect(await verifyPassword(DEMO_PASSWORD, hash)).toBe(false);
    expect(await verifyPassword("Vih@12345", hash)).toBe(false);
  });

  it("includes all primary internal roles in demo accounts", () => {
    const roles = DEMO_ACCOUNTS.map((a) => a.role);
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("SALES");
    expect(roles).toContain("CEO");
    expect(roles).toContain("FINANCE");
    expect(roles).toContain("OPERATIONS");
  });
});
