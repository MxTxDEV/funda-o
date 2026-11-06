import type { UserRole } from "@vc/db/values";
import { forbidden } from "../errors";

export const PERMISSIONS = [
  "dashboard:read",
  "departments:read",
  "departments:write",
  "agents:read",
  "agents:write",
  "tasks:read",
  "tasks:write",
  "approvals:read",
  "approvals:decide",
  "conversations:read",
  "conversations:write",
  "audit:read",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ: Permission[] = [
  "dashboard:read",
  "departments:read",
  "agents:read",
  "tasks:read",
  "approvals:read",
  "conversations:read",
];

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  admin: new Set(PERMISSIONS.filter((p) => p !== "users:manage")),
  operator: new Set([...READ, "tasks:write", "conversations:write"]),
  viewer: new Set(READ),
};

export type UserActor = { type: "user"; userId: string; email: string; role: UserRole };
/** Internal actors (worker process, CLI scripts). They never come from an HTTP request. */
export type InternalActor = { type: "worker" | "system"; label: string };
export type Actor = UserActor | InternalActor;

export const WORKER_ACTOR: InternalActor = { type: "worker", label: "worker" };
export const SYSTEM_ACTOR: InternalActor = { type: "system", label: "system" };

export function can(actor: Actor, permission: Permission): boolean {
  if (actor.type !== "user") return true;
  return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
}

export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) throw forbidden();
}

export function actorLabel(actor: Actor): string {
  return actor.type === "user" ? actor.email : actor.label;
}

export function actorUserId(actor: Actor): string | null {
  return actor.type === "user" ? actor.userId : null;
}
