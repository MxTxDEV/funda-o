import type { DepartmentZoneKey } from "@vc/core/client";
import { CHAIR_OFFSET, deskLocal, LOUNGE_SOFAS, type OfficeLayout, podCenters, ROOM_CENTERS, ROOM_D, ROOM_W } from "../layout";
import type { OfficeAgent, Vec3 } from "../types";
import type { KitTransform } from "./InstancedKit";

export type ScreenState = "active" | "idle" | "off";
export type ScreenTransform = { position: Vec3; rotationY: number; state: ScreenState; width: number; height: number };

/** Opaque feature wall side of a room (always a back side so it never hides the room). */
export function featureSide(center: Vec3): "-x" | "-z" {
  const [cx, , cz] = center;
  const door = cx === 0 ? (cz < 0 ? "+z" : "-z") : cx < 0 ? "+x" : "-x";
  return door === "-z" ? "-x" : door === "-x" ? "-z" : door === "+z" ? "-z" : "-x";
}

/** Positions along the feature wall (offset `t` meters from its middle), facing into the room. */
export function alongFeature(center: Vec3, t: number, inset: number): { position: Vec3; rotationY: number } {
  const [cx, , cz] = center;
  if (featureSide(center) === "-z") return { position: [cx + t, 0, cz - ROOM_D / 2 + inset], rotationY: 0 };
  return { position: [cx - ROOM_W / 2 + inset, 0, cz + t], rotationY: Math.PI / 2 };
}

function screenFor(agent: OfficeAgent | undefined): ScreenState {
  if (!agent) return "off";
  return agent.officeStatus === "executing" ? "active" : "idle";
}

/** Derives every furniture instance from the office layout (pure; recomputed when data changes). */
export function computeFurnishing(layout: OfficeLayout, agentsById: Map<string, OfficeAgent>) {
  const f = {
    desks: [] as KitTransform[],
    chairs: [] as KitTransform[],
    execChairs: [] as KitTransform[],
    lamps: [] as KitTransform[],
    laptops: [] as KitTransform[],
    deskPlants: [] as KitTransform[],
    headsets: [] as KitTransform[],
    notebooks: [] as KitTransform[],
    pendants: [] as KitTransform[],
    dividers: [] as KitTransform[],
    plants: [] as KitTransform[],
    tallPlants: [] as KitTransform[],
    cabinets: [] as KitTransform[],
    bookshelves: [] as KitTransform[],
    whiteboards: [] as KitTransform[],
    sofas: [] as KitTransform[],
    armchairs: [] as KitTransform[],
    coffeeTables: [] as KitTransform[],
    meetingTables: [] as KitTransform[],
    screens: [] as ScreenTransform[],
  };

  for (const room of layout.rooms) {
    const c = room.center;
    const exec = room.zone === "executive";
    room.desks.forEach((desk, i) => {
      const agent = desk.agentId ? agentsById.get(desk.agentId) : undefined;
      const chairPos = deskLocal(desk, 0, 0, -CHAIR_OFFSET);
      if (exec && i === 0) {
        // executive desk is rendered by ExecutiveFurniture; only the chair and screens come from here
        f.execChairs.push({ position: chairPos, rotationY: desk.rotationY });
        for (const dx of [-0.42, 0.42]) {
          f.screens.push({ position: deskLocal(desk, dx, 1.1, 0.17), rotationY: desk.rotationY + Math.PI, state: screenFor(agent), width: 0.74, height: 0.42 });
        }
        return;
      }
      const t = { position: desk.position, rotationY: desk.rotationY };
      f.desks.push(t);
      f.chairs.push({ position: chairPos, rotationY: desk.rotationY + (agent ? 0 : ((i % 3) - 1) * 0.25) });
      f.screens.push({ position: deskLocal(desk, 0, 1.08, 0.213), rotationY: desk.rotationY + Math.PI, state: screenFor(agent), width: 0.66, height: 0.37 });
      const seed = (room.zone.length * 7 + i * 13) % 12;
      if (seed % 3 === 0) f.lamps.push(t);
      if (seed % 4 === 1) f.laptops.push(t);
      if (seed % 3 === 2) f.deskPlants.push(t);
      if (agent && seed % 2 === 0) f.headsets.push(t);
      if (seed % 2 === 1) f.notebooks.push(t);
    });
    for (const p of podCenters(c, room.desks.length)) {
      f.dividers.push({ position: p });
      f.pendants.push({ position: [p[0] - 1.75, 0, p[2]], rotationY: Math.PI / 2 });
      f.pendants.push({ position: [p[0], 0, p[2]], rotationY: Math.PI / 2 });
      f.pendants.push({ position: [p[0] + 1.75, 0, p[2]], rotationY: Math.PI / 2 });
    }

    if (!exec) {
      // storage along the feature wall, on both sides of the sign
      f.cabinets.push(alongFeature(c, 3.6, 0.32));
      if (room.zone === "strategy") f.whiteboards.push(alongFeature(c, -3.6, 0.1));
      else f.bookshelves.push(alongFeature(c, -3.8, 0.26));
    }
    // plants in the two front corners
    f.plants.push({ position: [c[0] + ROOM_W / 2 - 0.5, 0, c[2] + ROOM_D / 2 - 0.5] });
    f.tallPlants.push({ position: [c[0] - ROOM_W / 2 + 0.55, 0, c[2] + ROOM_D / 2 - 0.55], rotationY: room.zone.length });
  }

  // Meeting room
  const m = ROOM_CENTERS.meeting;
  f.meetingTables.push({ position: m });
  for (let i = 0; i < 4; i++) {
    const x = m[0] - 1.8 + i * 1.2;
    f.chairs.push({ position: [x, 0, m[2] - 1.15] });
    f.chairs.push({ position: [x, 0, m[2] + 1.15], rotationY: Math.PI });
  }
  f.chairs.push({ position: [m[0] - 2.95, 0, m[2]], rotationY: Math.PI / 2 });
  f.chairs.push({ position: [m[0] + 2.95, 0, m[2]], rotationY: -Math.PI / 2 });
  f.cabinets.push({ position: [m[0] + 3.6, 0, m[2] - ROOM_D / 2 + 0.32] });
  f.plants.push({ position: [m[0] + ROOM_W / 2 - 0.5, 0, m[2] + ROOM_D / 2 - 0.5] });
  f.tallPlants.push({ position: [m[0] - ROOM_W / 2 + 0.55, 0, m[2] + ROOM_D / 2 - 0.55] });

  // Lounge
  const l = ROOM_CENTERS.lounge;
  for (const s of LOUNGE_SOFAS) f.sofas.push({ position: s.position, rotationY: s.rotationY });
  f.coffeeTables.push({ position: [l[0] - 1.6, 0, l[2] - 0.5] });
  f.armchairs.push({ position: [l[0] + 1.3, 0, l[2] - 0.1], rotationY: -Math.PI / 2 - 0.3 });
  f.plants.push({ position: [l[0] + ROOM_W / 2 - 0.5, 0, l[2] + ROOM_D / 2 - 0.5] });
  f.tallPlants.push({ position: [l[0] + 1.6, 0, l[2] - ROOM_D / 2 + 0.6] });

  // Executive room lounge corner + shelves
  const e = ROOM_CENTERS.executive;
  f.armchairs.push({ position: [e[0] + 3.0, 0, e[2] + 1.9], rotationY: Math.PI / 2 });
  f.armchairs.push({ position: [e[0] + 4.8, 0, e[2] + 1.9], rotationY: -Math.PI / 2 });
  f.coffeeTables.push({ position: [e[0] + 3.9, 0, e[2] + 1.9], rotationY: Math.PI / 2, scale: 0.8 });
  f.bookshelves.push({ position: [e[0] - 4.0, 0, e[2] - ROOM_D / 2 + 0.26] });
  f.bookshelves.push({ position: [e[0] + 4.0, 0, e[2] - ROOM_D / 2 + 0.26] });

  return f;
}

export type Furnishing = ReturnType<typeof computeFurnishing>;
export const DEPARTMENT_ROOMS: DepartmentZoneKey[] = ["strategy", "offers", "design", "funnels", "traffic", "executive"];
