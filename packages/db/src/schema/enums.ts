import { pgEnum } from "drizzle-orm/pg-core";
import {
  ACTOR_TYPES,
  AGENT_STATUSES,
  APPROVAL_STATUSES,
  AUTHOR_TYPES,
  CONVERSATION_KINDS,
  PRESENCE_STATES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  USER_ROLES,
} from "./values";

export * from "./values";

export const userRoleEnum = pgEnum("user_role", USER_ROLES);
export const agentStatusEnum = pgEnum("agent_status", AGENT_STATUSES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const approvalStatusEnum = pgEnum("approval_status", APPROVAL_STATUSES);
export const conversationKindEnum = pgEnum("conversation_kind", CONVERSATION_KINDS);
export const authorTypeEnum = pgEnum("author_type", AUTHOR_TYPES);
export const actorTypeEnum = pgEnum("actor_type", ACTOR_TYPES);
export const presenceStateEnum = pgEnum("presence_state", PRESENCE_STATES);
