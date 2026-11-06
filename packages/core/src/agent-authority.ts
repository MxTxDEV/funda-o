import type { AgentHierarchyLevel } from "@vc/db";
import { AppError } from "./errors";

/**
 * Organizational hierarchy: OWNER (user) → COO (Alex) → department directors → specialists.
 * Agents never hold owner powers. The actions below always require an explicit approval decided
 * by a human user through the approvals module — no agent level can perform them on its own.
 */
export const OWNER_RESERVED_ACTIONS = [
  "spend_money",
  "publish_campaign",
  "approve_payment",
  "purchase",
  "irreversible_external_action",
  "approve_request",
] as const;
export type OwnerReservedAction = (typeof OWNER_RESERVED_ACTIONS)[number];

export const OWNER_RESERVED_LABELS: Record<OwnerReservedAction, string> = {
  spend_money: "Gastar dinheiro",
  publish_campaign: "Publicar campanhas",
  approve_payment: "Aprovar pagamentos",
  purchase: "Fazer compras",
  irreversible_external_action: "Executar ações externas irreversíveis",
  approve_request: "Decidir aprovações",
};

/** Operational capabilities by level (used when agents start acting through the Central Brain). */
export const AGENT_CAPABILITIES: Record<AgentHierarchyLevel, readonly string[]> = {
  coo: ["coordinate_departments", "coordinate_tasks", "assign_tasks", "consolidate_reports", "request_approval"],
  director: ["coordinate_department_tasks", "review_deliverables", "request_approval"],
  specialist: ["execute_assigned_tasks", "request_approval"],
};

export const HIERARCHY_LABELS: Record<AgentHierarchyLevel, string> = {
  coo: "Diretor de Operações (COO)",
  director: "Diretor de departamento",
  specialist: "Especialista",
};

const RANK: Record<AgentHierarchyLevel, number> = { coo: 3, director: 2, specialist: 1 };

/** A manager must be strictly above its report in the hierarchy. */
export function canManage(manager: AgentHierarchyLevel, report: AgentHierarchyLevel) {
  return RANK[manager] > RANK[report];
}

export function isOwnerReserved(action: string): action is OwnerReservedAction {
  return (OWNER_RESERVED_ACTIONS as readonly string[]).includes(action);
}

export function agentMay(level: AgentHierarchyLevel, action: string): boolean {
  if (isOwnerReserved(action)) return false;
  return AGENT_CAPABILITIES[level].includes(action);
}

/** Throws unless the agent level may perform the action directly. Owner-reserved actions must go through approvals. */
export function assertAgentAuthority(level: AgentHierarchyLevel, action: string) {
  if (isOwnerReserved(action)) {
    throw new AppError("FORBIDDEN", `"${OWNER_RESERVED_LABELS[action]}" exige aprovação explícita do proprietário.`);
  }
  if (!agentMay(level, action)) throw new AppError("FORBIDDEN", "Ação fora da autoridade deste funcionário.");
}
