import type { LeadStatus, Priority } from "@prisma/client";

export type ScoreInput = {
  status?: LeadStatus;
  priority?: Priority;
  notes?: string | null;
  source?: string | null;
  email?: string | null;
  phone?: string | null;
  calls?: { outcome?: string | null; notes?: string | null; content?: string | null }[];
  taskCompletedCount?: number;
};

export type ScoreBreakdownItem = {
  factor: string;
  delta: number;
  note: string;
};

export function calculateLeadScore(input: ScoreInput) {
  let score = 35;
  const reasons: string[] = [];
  const breakdown: ScoreBreakdownItem[] = [];
  const addFactor = (factor: string, delta: number, note: string) => {
    if (delta === 0) return;
    score += delta;
    reasons.push(`${factor} ${delta >= 0 ? "+" : ""}${delta}`);
    breakdown.push({ factor, delta, note });
  };
  const text = `${input.notes ?? ""} ${(input.calls ?? [])
    .map((call) => `${call.outcome ?? ""} ${call.notes ?? ""} ${call.content ?? ""}`)
    .join(" ")}`.toLowerCase();

  if (input.email && input.phone) {
    addFactor("Good contact details", 5, "Lead has both email and phone captured.");
  }
  if (input.source && ["WEBSITE", "GOOGLE", "REFERRAL", "WHATSAPP"].includes(input.source.toUpperCase())) {
    addFactor("High-intent source", 8, "Source indicates active buying intent.");
  }
  if (input.priority === "HOT") {
    addFactor("Priority", 18, "Lead has been flagged as hot.");
  }
  if (text.includes("callback") || text.includes("call back")) {
    addFactor("Requested callback", 20, "Customer explicitly requested a call-back.");
  }
  if (text.includes("requirement") || text.includes("need") || text.includes("demo")) {
    addFactor("Confirmed requirement", 15, "The customer has outlined a requirement or demo request.");
  }
  if (text.includes("budget") || text.includes("pricing")) {
    addFactor("Budget discussed", 15, "Pricing or budget details are in the conversation history.");
  }
  if ((text.includes("interested") && !text.includes("not interested")) || input.status === "INTERESTED" || input.status === "QUALIFIED") {
    addFactor("High intent signal", 16, "Positive buying signals are present.");
  }
  if ((input.taskCompletedCount ?? 0) > 0) {
    addFactor("Follow-up response", 8, "The lead has responded to a follow-up action.");
  }
  if (text.includes("not interested") || text.includes("negative")) {
    addFactor("Negative sentiment", -10, "The customer expressed concern or disinterest.");
  }
  if (input.status === "INVALID" || text.includes("wrong number")) {
    addFactor("Invalid contact signal", -25, "Lead information is likely stale or invalid.");
  }
  if (input.status === "LOST") {
    addFactor("Lost status", -18, "The lead has already been marked lost.");
  }
  if (input.status === "CONVERTED") {
    score = Math.max(score, 92);
    addFactor("Converted customer floor", 0, "Converted accounts receive a stable high score floor.");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    score: normalizedScore,
    reasons: reasons.length ? reasons : ["Base fit score +35"],
    breakdown: breakdown.length ? breakdown : [{ factor: "Base fit", delta: 35, note: "Default lead-fit baseline." }],
    classification: normalizedScore >= 75 ? "HOT" : normalizedScore >= 45 ? "WARM" : "COLD"
  };
}

export function priorityFromScore(score: number): Priority {
  if (score >= 75) return "HOT";
  if (score >= 45) return "WARM";
  return "COLD";
}
