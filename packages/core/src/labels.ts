import type {
  AgentStatus,
  ApprovalStatus,
  ConversationKind,
  PresenceState,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@vc/db/values";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendente",
  queued: "Na fila",
  in_progress: "Em andamento",
  waiting_approval: "Aguardando aprovação",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export const PRESENCE_LABELS: Record<PresenceState, string> = {
  offline: "Offline",
  idle: "Disponível",
  working: "Trabalhando",
  waiting_approval: "Aguardando aprovação",
  paused: "Pausado",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

export const CONVERSATION_KIND_LABELS: Record<ConversationKind, string> = {
  direct: "Individual",
  department: "Departamento",
  general: "Geral",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Leitor",
};

export const TASK_EVENT_LABELS: Record<string, string> = {
  created: "Tarefa criada",
  assigned: "Responsável atribuído",
  queued: "Enviada para a fila",
  started: "Execução iniciada",
  progress: "Progresso",
  retry_scheduled: "Nova tentativa agendada",
  approval_requested: "Aprovação solicitada",
  approval_granted: "Aprovação concedida",
  approval_rejected: "Aprovação rejeitada",
  approval_cancelled: "Aprovação cancelada",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
  result_discarded: "Resultado descartado",
};
