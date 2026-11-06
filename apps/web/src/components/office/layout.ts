import { DEPARTMENT_ZONES, type DepartmentZoneKey } from "@vc/core/client";
import type { OfficeAgent, OfficeDepartment, OfficeSnapshot, Vec3 } from "./types";

/**
 * Spatial layout of the office (meters). Pure function of the snapshot: the database stays the
 * single source of truth; positions are derived (room by zone, desk by registration order).
 *
 *          x=-14            x=0             x=14
 *  z=-10   Estratégia       Diretoria       Ofertas
 *  z=0     Funis            CENTRAL BRAIN   Design
 *  z=10    Tráfego          Reuniões        Lazer
 */
export const ROOM_W = 12;
export const ROOM_D = 8.4;
export const FLOOR_W = 44;
export const FLOOR_D = 32;
export const MAX_DESKS = 12;

export type FixedRoomKey = "brain" | "executive" | "meeting" | "lounge";
export type RoomKey = DepartmentZoneKey | FixedRoomKey;

export const ROOM_CENTERS: Record<RoomKey, Vec3> = {
  strategy: [-14, 0, -10],
  executive: [0, 0, -10],
  offers: [14, 0, -10],
  funnels: [-14, 0, 0],
  brain: [0, 0, 0],
  design: [14, 0, 0],
  traffic: [-14, 0, 10],
  meeting: [0, 0, 10],
  lounge: [14, 0, 10],
};

export const FIXED_ROOM_LABELS: Record<FixedRoomKey, string> = {
  brain: "Central Brain",
  executive: "Diretoria",
  meeting: "Sala de Reuniões",
  lounge: "Sala de Lazer",
};

export type DeskSlot = { position: Vec3; agentId: string | null };
export type DepartmentRoom = {
  zone: DepartmentZoneKey;
  zoneLabel: string;
  center: Vec3;
  department: OfficeDepartment | null;
  desks: DeskSlot[];
  overflow: number;
};
export type AgentPlacement = { position: Vec3; rotationY: number; seat: "desk" | "lounge"; room: RoomKey };

/** Desk positions inside a room: rows of 3, front row closest to the camera. */
export function deskPositions(center: Vec3, count: number): Vec3[] {
  const n = Math.max(6, Math.min(MAX_DESKS, count));
  const cols = 3;
  const rows = Math.ceil(n / cols);
  const dz = rows <= 2 ? 2.8 : 7.0 / rows;
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    out.push([center[0] + (c - 1) * 3.5, 0, center[2] - ((rows - 1) * dz) / 2 + r * dz + 0.4]);
  }
  return out;
}

const LOUNGE_OFFSETS: [number, number][] = [
  [-2.4, -2.1],
  [-1.2, -2.1],
  [0, -2.1],
  [1.2, -2.1],
  [-4.1, -0.8],
  [-4.1, 0.4],
  [-4.1, 1.6],
  [-3.0, -2.1],
]
export const LOUNGE_SEATS: Vec3[] = LOUNGE_OFFSETS.map(([x, z]) => [ROOM_CENTERS.lounge[0] + x, 0, ROOM_CENTERS.lounge[2] + z]);

export function computeOfficeLayout(snapshot: OfficeSnapshot) {
  const rooms: DepartmentRoom[] = DEPARTMENT_ZONES.map((z) => {
    const department = snapshot.departments.find((d) => d.zone === z.key) ?? null;
    const members = department ? snapshot.agents.filter((a) => a.departmentId === department.id) : [];
    const atDesk = members.filter((a) => a.officeStatus !== "resting");
    const positions = deskPositions(ROOM_CENTERS[z.key], members.length);
    // Each member keeps its own desk (by registration order); resting members leave it empty.
    const desks: DeskSlot[] = positions.map((p) => ({ position: p, agentId: null }));
    for (const a of members) {
      if (a.deskIndex < desks.length && atDesk.includes(a)) desks[a.deskIndex]!.agentId = a.id;
    }
    return {
      zone: z.key,
      zoneLabel: z.label,
      center: ROOM_CENTERS[z.key],
      department,
      desks,
      overflow: Math.max(0, members.length - desks.length),
    };
  });

  const placements = new Map<string, AgentPlacement>();
  for (const room of rooms) {
    for (const desk of room.desks) {
      if (desk.agentId) {
        placements.set(desk.agentId, {
          position: [desk.position[0], 0, desk.position[2] - 0.75],
          rotationY: 0,
          seat: "desk",
          room: room.zone,
        });
      }
    }
  }
  const resting = snapshot.agents.filter((a) => a.officeStatus === "resting");
  resting.slice(0, LOUNGE_SEATS.length).forEach((a, i) => {
    const seat = LOUNGE_SEATS[i]!;
    placements.set(a.id, { position: seat, rotationY: seat[0] < ROOM_CENTERS.lounge[0] - 3 ? Math.PI / 2 : 0, seat: "lounge", room: "lounge" });
  });

  const unplacedAgents: OfficeAgent[] = snapshot.agents.filter((a) => !placements.has(a.id));
  return { rooms, placements, unplacedAgents };
}

export type OfficeLayout = ReturnType<typeof computeOfficeLayout>;

/** World position the camera should frame for a selection. */
export function focusPoint(layout: OfficeLayout, kind: string, id: string): { target: Vec3; distance: number } | null {
  if (kind === "agent") {
    const p = layout.placements.get(id);
    return p ? { target: [p.position[0], 0.8, p.position[2]], distance: 12 } : null;
  }
  if (kind === "department") {
    const room = layout.rooms.find((r) => r.department?.id === id);
    return room ? { target: room.center, distance: 21 } : null;
  }
  if (kind === "zone") {
    const room = layout.rooms.find((r) => r.zone === id);
    return room ? { target: room.center, distance: 21 } : null;
  }
  if (kind === "room" && id in ROOM_CENTERS) {
    return { target: ROOM_CENTERS[id as RoomKey], distance: id === "brain" ? 17 : 21 };
  }
  return null;
}
