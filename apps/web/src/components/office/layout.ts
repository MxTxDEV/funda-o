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
/** Distance between the desk center and the occupant's chair (occupant sits at -z, facing +z). */
export const CHAIR_OFFSET = 0.55;

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

export type DeskSlot = { position: Vec3; rotationY: number; agentId: string | null };
export type DepartmentRoom = {
  zone: DepartmentZoneKey;
  zoneLabel: string;
  center: Vec3;
  department: OfficeDepartment | null;
  desks: DeskSlot[];
  overflow: number;
};
export type AgentPlacement = { position: Vec3; rotationY: number; seat: "desk" | "lounge"; room: RoomKey };

/** Diretoria seats: the main executive desk plus two side desks. */
export const EXECUTIVE_DESKS: { position: Vec3; rotationY: number }[] = [
  { position: [ROOM_CENTERS.executive[0] - 1.0, 0, ROOM_CENTERS.executive[2] - 1.0], rotationY: 0 },
  { position: [ROOM_CENTERS.executive[0] - 4.2, 0, ROOM_CENTERS.executive[2] + 2.0], rotationY: 0 },
  { position: [ROOM_CENTERS.executive[0] - 1.2, 0, ROOM_CENTERS.executive[2] + 2.4], rotationY: 0 },
];

/** Rotates a desk-local offset (x, z) into world space. */
export function deskLocal(desk: { position: Vec3; rotationY: number }, lx: number, ly: number, lz: number): Vec3 {
  const c = Math.cos(desk.rotationY);
  const s = Math.sin(desk.rotationY);
  return [desk.position[0] + lx * c + lz * s, ly, desk.position[2] - lx * s + lz * c];
}

/**
 * Workstations as facing pods (two rows of desks back to back, monitors in the middle).
 * Slot order alternates sides so a two-person team faces each other; slot 0 faces the camera.
 */
export function deskPositions(center: Vec3, count: number): { position: Vec3; rotationY: number }[] {
  if (center === ROOM_CENTERS.executive) return EXECUTIVE_DESKS.slice(0, Math.max(1, Math.min(3, count)));
  const n = Math.max(6, Math.min(MAX_DESKS, count));
  const pods = Math.ceil(n / 6);
  const out: { position: Vec3; rotationY: number }[] = [];
  for (let i = 0; i < n; i++) {
    const pod = Math.floor(i / 6);
    const k = i % 6;
    const col = Math.floor(k / 2);
    const faceCamera = k % 2 === 0;
    const podZ = center[2] + 0.3 + (pod - (pods - 1) / 2) * 3.6;
    const x = center[0] + (col - 1) * 1.75;
    out.push(faceCamera ? { position: [x, 0, podZ - 0.41], rotationY: 0 } : { position: [x, 0, podZ + 0.41], rotationY: Math.PI });
  }
  return out;
}

/** Acoustic divider positions (center of each pod). */
export function podCenters(center: Vec3, deskCount: number): Vec3[] {
  if (center === ROOM_CENTERS.executive) return [];
  const pods = Math.ceil(Math.max(6, Math.min(MAX_DESKS, deskCount)) / 6);
  return Array.from({ length: pods }, (_, pod) => [center[0], 0, center[2] + 0.3 + (pod - (pods - 1) / 2) * 3.6] as Vec3);
}

/** Lounge sofas (shared by the furniture and the seat positions). */
export const LOUNGE_SOFAS: { position: Vec3; rotationY: number }[] = [
  { position: [ROOM_CENTERS.lounge[0] - 1.2, 0, ROOM_CENTERS.lounge[2] - 2.4], rotationY: 0 },
  { position: [ROOM_CENTERS.lounge[0] - 4.6, 0, ROOM_CENTERS.lounge[2] + 0.6], rotationY: Math.PI / 2 },
];
export const LOUNGE_SEATS: { position: Vec3; rotationY: number }[] = LOUNGE_SOFAS.flatMap(({ position, rotationY }) =>
  [-0.74, 0, 0.74].map((dx) => {
    const lx = dx;
    const lz = 0.06;
    const x = position[0] + lx * Math.cos(rotationY) + lz * Math.sin(rotationY);
    const z = position[2] - lx * Math.sin(rotationY) + lz * Math.cos(rotationY);
    return { position: [x, 0, z] as Vec3, rotationY };
  }),
);

export function computeOfficeLayout(snapshot: OfficeSnapshot) {
  const rooms: DepartmentRoom[] = DEPARTMENT_ZONES.map((z) => {
    const department = snapshot.departments.find((d) => d.zone === z.key) ?? null;
    const members = department ? snapshot.agents.filter((a) => a.departmentId === department.id) : [];
    const atDesk = members.filter((a) => a.officeStatus !== "resting");
    const positions = deskPositions(ROOM_CENTERS[z.key], members.length);
    // Each member keeps its own desk (by registration order); resting members leave it empty.
    const desks: DeskSlot[] = positions.map((p) => ({ ...p, agentId: null }));
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
          position: deskLocal(desk, 0, 0, -CHAIR_OFFSET),
          rotationY: desk.rotationY,
          seat: "desk",
          room: room.zone,
        });
      }
    }
  }
  const resting = snapshot.agents.filter((a) => a.officeStatus === "resting");
  resting.slice(0, LOUNGE_SEATS.length).forEach((a, i) => {
    const seat = LOUNGE_SEATS[i]!;
    placements.set(a.id, { position: seat.position, rotationY: seat.rotationY, seat: "lounge", room: "lounge" });
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
  if (kind === "room" && id === "executive") {
    const room = layout.rooms.find((r) => r.zone === "executive");
    return { target: room?.center ?? ROOM_CENTERS.executive, distance: 19 };
  }
  if (kind === "room" && id in ROOM_CENTERS) {
    return { target: ROOM_CENTERS[id as RoomKey], distance: id === "brain" ? 17 : 21 };
  }
  return null;
}
