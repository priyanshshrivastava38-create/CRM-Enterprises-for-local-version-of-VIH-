import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./auth";

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases addresses before auth checks", () => {
    expect(normalizeEmail(" VIH.SALES@VIH.DEMO ")).toBe("vih.sales@vih.demo");
  });
});
