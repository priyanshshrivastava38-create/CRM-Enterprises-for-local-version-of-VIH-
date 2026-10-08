type WorkflowLead = {
  id?: string;
  firstName?: string;
  priority?: "HOT" | "WARM" | "COLD";
  status?: string;
};

export type WorkflowAction = {
  id: string;
  name: string;
  description: string;
  when: (lead: WorkflowLead) => boolean;
  run: (lead: WorkflowLead) => { ok: boolean; message: string };
};

export function createDefaultWorkflowActions() {
  const actions: WorkflowAction[] = [
    {
      id: "assign-hot-lead",
      name: "Boost priority review",
      description: "Escalate hot or urgent leads to senior follow-up routing.",
      when: (lead) => lead.priority === "HOT" && lead.status !== "CONVERTED",
      run: (lead) => ({ ok: true, message: `${lead.firstName ?? "Lead"} flagged for senior review.` })
    },
    {
      id: "nudge-follow-up",
      name: "Send follow-up nudge",
      description: "Trigger a reminder when follow-up exceeds target SLA.",
      when: (lead) => lead.status === "FOLLOW_UP" || lead.priority === "WARM",
      run: (lead) => ({ ok: true, message: `Follow-up reminder scheduled for ${lead.firstName ?? "lead"}.` })
    },
    {
      id: "pause-dormant",
      name: "Pause dormant lead",
      description: "Move stale, low-intent leads into nurture after inactivity.",
      when: (lead) => lead.status === "NURTURE" || lead.priority === "COLD",
      run: (lead) => ({ ok: true, message: `${lead.firstName ?? "Lead"} moved to nurture.` })
    }
  ];

  return actions;
}

export function evaluateWorkflowActions(lead: WorkflowLead, actions: WorkflowAction[] = createDefaultWorkflowActions()) {
  return actions.filter((action) => action.when(lead)).map((action) => ({
    id: action.id,
    leadId: lead.id,
    name: action.name,
    description: action.description,
    ...action.run(lead)
  }));
}
