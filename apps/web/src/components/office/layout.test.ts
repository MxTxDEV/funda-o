import { describe, expect, it } from "vitest";
import { computeOfficeLayout, deskPositions, focusPoint, MAX_DESKS, ROOM_CENTERS } from "./layout";
import type { OfficeSnapshot } from "./types";

type Agent = OfficeSnapshot["agents"][number];
const agent = (id: string, deskIndex: number, officeStatus: Agent["officeStatus"] = "available", departmentId = "d1"): Agent =>
  ({ id, deskIndex, officeStatus, departmentId, name: id }) as Agent;

const snapshot = (agents: Agent[], zone: "offers" | null = "offers"): OfficeSnapshot =>
  ({
    agents,
    departments: [{ id: "d1", name: "Copy", zone, agentCount: agents.length } as OfficeSnapshot["departments"][number]],
  }) as OfficeSnapshot;

describe("office layout", () => {
  it("gives each employee its own desk in its department room", () => {
    const layout = computeOfficeLayout(snapshot([agent("a", 0), agent("b", 1, "executing")]));
    const room = layout.rooms.find((r) => r.zone === "offers")!;
    expect(room.department?.id).toBe("d1");
    expect(room.desks).toHaveLength(6);
    expect(room.desks[0]!.agentId).toBe("a");
    expect(room.desks[1]!.agentId).toBe("b");
    expect(layout.placements.get("a")?.seat).toBe("desk");
    expect(layout.rooms.filter((r) => !r.department)).toHaveLength(5);
  });

  it("sends resting employees to the lounge and frees their desk", () => {
    const layout = computeOfficeLayout(snapshot([agent("a", 0, "resting"), agent("b", 1)]));
    expect(layout.placements.get("a")).toMatchObject({ seat: "lounge", room: "lounge" });
    expect(layout.rooms.find((r) => r.zone === "offers")!.desks[0]!.agentId).toBeNull();
  });

  it("caps desks per room and reports overflow", () => {
    const many = Array.from({ length: MAX_DESKS + 2 }, (_, i) => agent(`a${i}`, i));
    const layout = computeOfficeLayout(snapshot(many));
    const room = layout.rooms.find((r) => r.zone === "offers")!;
    expect(room.desks).toHaveLength(MAX_DESKS);
    expect(room.overflow).toBe(2);
    expect(layout.unplacedAgents.map((a) => a.id)).toEqual([`a${MAX_DESKS}`, `a${MAX_DESKS + 1}`]);
  });

  it("keeps desks inside the room bounds", () => {
    for (const n of [1, 6, 9, 12]) {
      for (const { position: [x, , z] } of deskPositions(ROOM_CENTERS.design, n)) {
        expect(Math.abs(x - ROOM_CENTERS.design[0])).toBeLessThan(6);
        expect(Math.abs(z - ROOM_CENTERS.design[2])).toBeLessThan(4.2);
      }
    }
  });

  it("frames employees, departments and fixed rooms", () => {
    const layout = computeOfficeLayout(snapshot([agent("a", 0)]));
    expect(focusPoint(layout, "agent", "a")?.distance).toBeGreaterThan(0);
    expect(focusPoint(layout, "department", "d1")?.target).toEqual(ROOM_CENTERS.offers);
    expect(focusPoint(layout, "room", "brain")?.target).toEqual(ROOM_CENTERS.brain);
    expect(focusPoint(layout, "agent", "missing")).toBeNull();
  });
});
