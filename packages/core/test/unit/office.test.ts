import { describe, expect, it } from "vitest";
import { deriveOfficeStatus, matchZoneByName, resolveDepartmentZones } from "../../src/office";

const d = (id: string, name: string, t: number) => ({ id, name, createdAt: new Date(t) });

describe("office zones", () => {
  it("matches rooms by department name", () => {
    expect(matchZoneByName("Pesquisa & Inteligência")).toBe("strategy");
    expect(matchZoneByName("Criação & Copy")).toBe("offers");
    expect(matchZoneByName("Tráfego Pago")).toBe("traffic");
    expect(matchZoneByName("Financeiro")).toBeNull();
  });

  it("honors assignments, then names, then free rooms; overflows are unplaced", () => {
    const depts = [d("a", "Financeiro", 1), d("b", "Copy", 2), d("c", "Tráfego", 3), d("e", "RH", 4), d("f", "Jurídico", 5), d("g", "Ops", 6), d("h", "X", 7)];
    const { placement, unplaced } = resolveDepartmentZones(depts, new Map([["c", "design"]]));
    expect(placement.get("c")).toEqual({ zone: "design", source: "assigned" });
    expect(placement.get("b")?.zone).toBe("offers");
    expect(placement.get("a")?.zone).toBe("strategy");
    expect(new Set([...placement.values()].map((p) => p.zone)).size).toBe(placement.size);
    expect(placement.size).toBe(5);
    expect(unplaced).toEqual(["g", "h"]);
  });

  it("ignores invalid stored zones", () => {
    const { placement } = resolveDepartmentZones([d("a", "Copy", 1)], new Map([["a", "spaceship"]]));
    expect(placement.get("a")).toEqual({ zone: "offers", source: "auto" });
  });
});

describe("office status", () => {
  it("derives only from real state", () => {
    expect(deriveOfficeStatus({ agentStatus: "paused", presence: "paused", queuedTasks: 0 })).toBe("resting");
    expect(deriveOfficeStatus({ agentStatus: "active", presence: "working", queuedTasks: 0 })).toBe("executing");
    expect(deriveOfficeStatus({ agentStatus: "active", presence: "waiting_approval", queuedTasks: 2 })).toBe("awaiting_approval");
    expect(deriveOfficeStatus({ agentStatus: "active", presence: "idle", queuedTasks: 1 })).toBe("working");
    expect(deriveOfficeStatus({ agentStatus: "active", presence: "idle", queuedTasks: 0 })).toBe("available");
  });
});
