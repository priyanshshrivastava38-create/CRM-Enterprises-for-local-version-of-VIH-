import { describe, expect, it } from "vitest";
import { getLeadSlaState, summarizeSlaHealth, type LeadSlaInput } from "./sla";

describe("SLA health and escalation logic", () => {
  it("marks a hot lead with a missed follow-up as escalated", () => {
    const lead: LeadSlaInput = {
      priority: "HOT",
      status: "FOLLOW_UP",
      nextFollowUpAt: new Date("2024-01-01T00:00:00.000Z")
    };

    const state = getLeadSlaState(lead, new Date("2024-01-02T00:00:00.000Z"));

    expect(state.status).toBe("ESCALATED");
    expect(state.hoursLate).toBeGreaterThan(0);
  });

  it("keeps a warm lead within SLA as healthy", () => {
    const lead: LeadSlaInput = {
      priority: "WARM",
      status: "CONTACTED",
      nextFollowUpAt: new Date(Date.now() + 36 * 60 * 60 * 1000)
    };

    const state = getLeadSlaState(lead, new Date());

    expect(state.status).toBe("OK");
  });

  it("summarizes group health with counts by status", () => {
    const leads: LeadSlaInput[] = [
      { priority: "HOT", status: "FOLLOW_UP", nextFollowUpAt: new Date("2024-01-01T00:00:00.000Z") },
      { priority: "WARM", status: "CONTACTED", nextFollowUpAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
      { priority: "COLD", status: "NURTURE", nextFollowUpAt: new Date(Date.now() + 72 * 60 * 60 * 1000) }
    ];

    const summary = summarizeSlaHealth(leads, new Date("2024-01-02T00:00:00.000Z"));

    expect(summary.escalated).toBeGreaterThanOrEqual(1);
    expect(summary.ok).toBeGreaterThanOrEqual(1);
  });
});
