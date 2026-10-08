import type { Lead, Call } from "@prisma/client";

export function analyzeLead(lead: Lead & { calls?: Call[] }) {
  const callText = (lead.calls ?? []).map((call) => `${call.outcome ?? ""} ${call.notes ?? ""} ${call.transcript ?? ""} ${call.content ?? ""}`).join(" ");
  const text = `${lead.notes ?? ""} ${callText}`.toLowerCase();
  const hot = lead.score >= 75 || lead.priority === "HOT";
  const pricing = text.includes("pricing") || text.includes("budget");
  const callback = text.includes("callback") || text.includes("call back");
  const requirement = pricing ? "Asked about pricing and package fit" : "Exploring Vih Metaverse solution fit";
  const objection =
    text.includes("expensive") && !text.includes("not expensive") && !text.includes("inexpensive")
      ? "Pricing sensitivity"
      : text.includes("timeline")
        ? "Timeline clarity"
        : text.includes("feature")
          ? "Feature fit"
          : "None captured";
  const customerIntent = hot ? "High purchase intent" : lead.score >= 45 ? "Researching with moderate intent" : "Low intent / requires nurturing";
  const summary = hot
    ? `${lead.firstName} is showing strong commercial intent and should be managed as a priority opportunity.`
    : `${lead.firstName} is active in the pipeline and needs a clear, timely next touchpoint.`;

  return {
    mock: true,
    summary,
    intent: hot ? "High" : lead.score >= 45 ? "Medium" : "Low",
    customerIntent,
    keyRequirements: requirement,
    sentiment: text.includes("not interested") ? "Negative" : hot ? "Positive" : "Neutral",
    requirement,
    objections: objection,
    buyingTimeline: callback ? "Immediate callback requested" : hot ? "This week" : "Needs follow-up",
    recommendedNextAction: callback
      ? "Call the lead today between 4-6 PM because they requested a callback."
      : hot
        ? "Schedule a product demo and confirm budget, timeline, and decision maker."
        : "Send a concise follow-up and ask one qualifying question.",
    nextBestAction: callback
      ? "Call the customer and confirm the callback window."
      : hot
        ? "Prepare demo + confirm stakeholder and budget."
        : "Send a short follow-up and ask one decision-driving question.",
    confidence: hot ? 86 : lead.score >= 45 ? 72 : 58,
    scoreSummary: `${lead.score}/100 • ${lead.score >= 75 ? "Hot" : lead.score >= 45 ? "Warm" : "Cold"}`
  };
}
