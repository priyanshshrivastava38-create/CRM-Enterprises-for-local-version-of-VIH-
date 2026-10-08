export type SlaStatus = "OK" | "WARNING" | "ESCALATED";

export type LeadSlaInput = {
  priority: "HOT" | "WARM" | "COLD";
  status: string;
  nextFollowUpAt?: Date | string | null;
};

export type LeadSlaState = {
  status: SlaStatus;
  hoursLate: number;
  targetHours: number;
  label: string;
};

const SLA_TARGETS = {
  HOT: 24,
  WARM: 48,
  COLD: 72
} as const;

export function getLeadSlaState(lead: LeadSlaInput, now = new Date()): LeadSlaState {
  const targetHours = SLA_TARGETS[lead.priority] ?? 48;
  const nextFollowUpAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
  const isOverdue = !!nextFollowUpAt && nextFollowUpAt.getTime() < now.getTime();
  const hoursLate = isOverdue ? Math.max(1, Math.ceil((now.getTime() - nextFollowUpAt.getTime()) / (60 * 60 * 1000))) : 0;

  if (!nextFollowUpAt || lead.status === "CONVERTED" || lead.status === "LOST" || lead.status === "INVALID") {
    return { status: "OK", hoursLate: 0, targetHours, label: "No active SLA risk" };
  }

  if (hoursLate >= targetHours || lead.status === "FOLLOW_UP") {
    return {
      status: "ESCALATED",
      hoursLate,
      targetHours,
      label: `${hoursLate}h overdue · manager escalation recommended`
    };
  }

  if (hoursLate > targetHours * 0.6) {
    return {
      status: "WARNING",
      hoursLate,
      targetHours,
      label: `${hoursLate}h overdue · review follow-up soon`
    };
  }

  return {
    status: "OK",
    hoursLate: 0,
    targetHours,
    label: `Within SLA · ${targetHours}h target`
  };
}

export function summarizeSlaHealth(leads: LeadSlaInput[], now = new Date()) {
  const summary = { ok: 0, warning: 0, escalated: 0 };

  for (const lead of leads) {
    const state = getLeadSlaState(lead, now);
    summary[state.status.toLowerCase() as keyof typeof summary] += 1;
  }

  return summary;
}
