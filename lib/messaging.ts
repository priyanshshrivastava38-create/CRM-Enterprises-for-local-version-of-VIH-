// Team channels and access rules for internal messaging (pure, so the rules are unit-testable).

export type TeamChannel = {
  key: string;
  name: string;
  description: string;
  members: string[];
  /** Private channels are only visible to their members; open channels can be read and posted to by anyone. */
  private?: boolean;
};

const ALL_ROLES = ["ADMIN", "SALES", "CEO", "FINANCE", "OPERATIONS", "CSO", "CTO", "CFO", "REGIONAL_SALES_HEAD"];

export const TEAM_CHANNELS: TeamChannel[] = [
  { key: "COMPANY", name: "Company-wide", description: "Announcements and updates for everyone", members: ALL_ROLES },
  { key: "LEADERSHIP", name: "Leadership", description: "CEO, CFO, CSO and admins", members: ["CEO", "CFO", "CSO", "ADMIN"], private: true },
  { key: "SALES", name: "Sales team", description: "Deals, leads, and customer conversations", members: ["SALES", "REGIONAL_SALES_HEAD", "CSO"] },
  { key: "FINANCE", name: "Finance team", description: "Billing, invoices, payments, and approvals", members: ["FINANCE", "CFO"] },
  { key: "OPERATIONS", name: "Operations & Tech", description: "Onboarding, platform setup, and usage", members: ["OPERATIONS", "CTO"] }
];

/** Roles that can post one message to several team channels at once. */
const BROADCAST_ROLES = ["CEO", "CFO", "CSO", "ADMIN", "REGIONAL_SALES_HEAD"];

export function teamChannel(key: string) {
  return TEAM_CHANNELS.find((team) => team.key === key) ?? null;
}

export function teamConversationKey(team: string) {
  return `team:${team}`;
}

/** Direct-message key is order-independent so both people resolve to the same conversation. */
export function directConversationKey(userA: string, userB: string) {
  return `dm:${[userA, userB].sort().join(":")}`;
}

export function canAccessTeam(role: string, teamKey: string) {
  const team = teamChannel(teamKey);
  if (!team) return false;
  return !team.private || role === "ADMIN" || team.members.includes(role);
}

export function isTeamMember(role: string, teamKey: string) {
  return teamChannel(teamKey)?.members.includes(role) ?? false;
}

export function canBroadcast(role: string) {
  return BROADCAST_ROLES.includes(role);
}

export function accessibleTeams(role: string) {
  return TEAM_CHANNELS.filter((team) => canAccessTeam(role, team.key));
}
