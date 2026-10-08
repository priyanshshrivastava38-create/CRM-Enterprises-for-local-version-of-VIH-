import { describe, expect, it } from "vitest";
import { normalizeLeadCsvRows } from "./lead-import";

describe("normalizeLeadCsvRows", () => {
  it("maps a spreadsheet row into the CRM lead schema", () => {
    const result = normalizeLeadCsvRows([
      {
        "First Name": "Asha",
        "Last Name": "Sharma",
        Email: "asha@example.com",
        Phone: "+91 9876543210",
        Company: "Acme Labs",
        Designation: "Founder",
        City: "Bengaluru",
        Source: "Google",
        Status: "NEW",
        Priority: "HOT",
        "Assigned Agent": "ViH Sales User",
        "Next Follow-up": "2026-10-10",
        Notes: "Discuss onboarding"
      }
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      firstName: "Asha",
      lastName: "Sharma",
      email: "asha@example.com",
      phone: "+91 9876543210",
      company: "Acme Labs",
      source: "Google",
      status: "NEW",
      priority: "HOT",
      notes: "Discuss onboarding"
    });
    expect(result.errors).toEqual([]);
  });

  it("returns useful errors for missing required fields", () => {
    const result = normalizeLeadCsvRows([{ Email: "invalid", Phone: "123" }]);

    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain("row 2");
    expect(result.errors[0]).toContain("First Name");
  });
});
