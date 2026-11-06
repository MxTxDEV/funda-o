import { describe, expect, it } from "vitest";
import { agentMay, assertAgentAuthority, canManage, OWNER_RESERVED_ACTIONS } from "../../src/agent-authority";
import { type AgentActor, can } from "../../src/auth/permissions";
import { matchZoneByName } from "../../src/office";
import { TEAM_ROSTER } from "../../src/team-roster";

describe("agent authority", () => {
  it("reserves money, publishing, payments, purchases and approvals to the owner — even for the COO", () => {
    for (const action of OWNER_RESERVED_ACTIONS) {
      expect(agentMay("coo", action)).toBe(false);
      expect(() => assertAgentAuthority("coo", action)).toThrow(/aprovação/);
    }
    expect(agentMay("coo", "coordinate_departments")).toBe(true);
    expect(agentMay("specialist", "coordinate_departments")).toBe(false);
  });

  it("orders the hierarchy COO > director > specialist", () => {
    expect(canManage("coo", "director")).toBe(true);
    expect(canManage("director", "specialist")).toBe(true);
    expect(canManage("director", "director")).toBe(false);
    expect(canManage("specialist", "coo")).toBe(false);
  });

  it("agent actors never decide approvals or manage the organization", () => {
    const alex: AgentActor = { type: "agent", agentId: "x", label: "Alex", level: "coo" };
    expect(can(alex, "tasks:write")).toBe(true);
    expect(can(alex, "approvals:decide")).toBe(false);
    expect(can(alex, "departments:write")).toBe(false);
    expect(can(alex, "agents:write")).toBe(false);
    expect(can(alex, "users:manage")).toBe(false);
    expect(can({ ...alex, level: "specialist" }, "tasks:write")).toBe(false);
  });
});

describe("initial team roster", () => {
  it("has 11 members with a valid chain: owner → Alex → directors → specialists", () => {
    expect(TEAM_ROSTER).toHaveLength(11);
    const byKey = new Map(TEAM_ROSTER.map((m) => [m.key, m]));
    expect(TEAM_ROSTER.filter((m) => m.level === "coo").map((m) => m.name)).toEqual(["Alex"]);
    expect(TEAM_ROSTER.filter((m) => m.level === "director")).toHaveLength(5);
    for (const m of TEAM_ROSTER) {
      if (m.level === "coo") expect(m.reportsTo).toBeNull();
      else {
        const manager = byKey.get(m.reportsTo!)!;
        expect(canManage(manager.level, m.level)).toBe(true);
        // managers come first in the roster
        expect(TEAM_ROSTER.indexOf(manager)).toBeLessThan(TEAM_ROSTER.indexOf(m));
      }
    }
  });

  it("maps department names to the right rooms", () => {
    expect(matchZoneByName("Diretoria")).toBe("executive");
    expect(matchZoneByName("Direção de Arte")).not.toBe("strategy");
    expect(matchZoneByName("Estratégia & Pesquisa")).toBe("strategy");
    expect(matchZoneByName("Funis & Desenvolvimento")).toBe("funnels");
  });
});
