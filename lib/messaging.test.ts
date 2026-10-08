import { describe, expect, it } from "vitest";
import { accessibleTeams, canAccessTeam, canBroadcast, directConversationKey, isTeamMember } from "./messaging";

describe("team channel access", () => {
  it("lets sales post to Finance but keeps Leadership private", () => {
    expect(canAccessTeam("SALES", "FINANCE")).toBe(true);
    expect(canAccessTeam("SALES", "LEADERSHIP")).toBe(false);
    expect(canAccessTeam("CEO", "LEADERSHIP")).toBe(true);
    expect(canAccessTeam("ADMIN", "LEADERSHIP")).toBe(true);
    expect(canAccessTeam("FINANCE", "UNKNOWN")).toBe(false);
  });

  it("gives the CEO every channel and lists only accessible ones", () => {
    expect(accessibleTeams("CEO").map((team) => team.key)).toEqual(["COMPANY", "LEADERSHIP", "SALES", "FINANCE", "OPERATIONS"]);
    expect(accessibleTeams("SALES").map((team) => team.key)).not.toContain("LEADERSHIP");
  });

  it("tracks home-team membership separately from access", () => {
    expect(isTeamMember("FINANCE", "FINANCE")).toBe(true);
    expect(isTeamMember("SALES", "FINANCE")).toBe(false);
  });

  it("allows broadcasts from leaders only", () => {
    expect(canBroadcast("CEO")).toBe(true);
    expect(canBroadcast("SALES")).toBe(false);
  });
});

describe("directConversationKey", () => {
  it("is the same regardless of who starts the conversation", () => {
    expect(directConversationKey("b", "a")).toBe(directConversationKey("a", "b"));
  });
});
