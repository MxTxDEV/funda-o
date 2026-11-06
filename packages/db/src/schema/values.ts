/** Plain enum values with no runtime dependencies (safe to import in client bundles). */
export const USER_ROLES = ["owner", "admin", "operator", "viewer"] as const;
export const AGENT_STATUSES = ["active", "paused", "archived"] as const;
export const TASK_STATUSES = [
  "pending",
  "queued",
  "in_progress",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const CONVERSATION_KINDS = ["direct", "department", "general"] as const;
export const AUTHOR_TYPES = ["user", "agent", "system"] as const;
export const ACTOR_TYPES = ["user", "system", "worker", "agent"] as const;
export const PRESENCE_STATES = ["offline", "idle", "working", "waiting_approval", "paused"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];
export type AuthorType = (typeof AUTHOR_TYPES)[number];
export type ActorType = (typeof ACTOR_TYPES)[number];
export type PresenceState = (typeof PRESENCE_STATES)[number];
