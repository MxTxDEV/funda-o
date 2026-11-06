import { relations } from "drizzle-orm";
import { agentVersions, agents } from "./agents";
import { approvals } from "./approvals";
import { conversations, messages } from "./conversations";
import { departments } from "./departments";
import { agentPresence } from "./presence";
import { taskEvents, tasks } from "./tasks";

export const departmentsRelations = relations(departments, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  department: one(departments, { fields: [agents.departmentId], references: [departments.id] }),
  reportsTo: one(agents, { fields: [agents.reportsToAgentId], references: [agents.id], relationName: "reports_to" }),
  directReports: many(agents, { relationName: "reports_to" }),
  currentVersion: one(agentVersions, { fields: [agents.currentVersionId], references: [agentVersions.id] }),
  versions: many(agentVersions),
  presence: one(agentPresence, { fields: [agents.id], references: [agentPresence.agentId] }),
}));

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agent: one(agents, { fields: [agentVersions.agentId], references: [agents.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  agent: one(agents, { fields: [tasks.assignedAgentId], references: [agents.id] }),
  department: one(departments, { fields: [tasks.departmentId], references: [departments.id] }),
  events: many(taskEvents),
  approvals: many(approvals),
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
  task: one(tasks, { fields: [taskEvents.taskId], references: [tasks.id] }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  task: one(tasks, { fields: [approvals.taskId], references: [tasks.id] }),
  agent: one(agents, { fields: [approvals.agentId], references: [agents.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  department: one(departments, { fields: [conversations.departmentId], references: [departments.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const agentPresenceRelations = relations(agentPresence, ({ one }) => ({
  agent: one(agents, { fields: [agentPresence.agentId], references: [agents.id] }),
}));
