import { describe, expect, it } from "vitest";
import { inr, inrCompact } from "./format";

describe("currency formatting", () => {
  it("formats full rupee amounts with Indian digit grouping", () => {
    expect(inr(519500)).toBe("₹5,19,500");
  });

  it("abbreviates large amounts in lakh and crore", () => {
    expect(inrCompact(519500)).toBe("₹5.2L");
    expect(inrCompact(10400000)).toBe("₹1.04Cr");
    expect(inrCompact(25000)).toBe("₹25K");
    expect(inrCompact(0)).toBe("₹0");
    expect(inrCompact(-150000)).toBe("-₹1.5L");
  });
});
