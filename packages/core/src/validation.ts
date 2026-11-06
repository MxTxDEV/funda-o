import {
  AGENT_STATUSES,
  APPROVAL_STATUSES,
  CONVERSATION_KINDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@vc/db/values";
import { z } from "zod";
import { TASK_TYPE_IDS } from "./task-types";
import { isKnownTool } from "./tools";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

/** HTML forms send "" for empty fields: treat it as "not provided". */
const optionalUuid = z
  .union([z.literal(""), z.uuid({ message: "Identificador inválido" })])
  .optional()
  .transform((v) => v || undefined);

/** Optional free text; "" becomes undefined. */
const optionalText = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => v === undefined || v.length >= min, { message: `Mínimo de ${min} caracteres` });

/** Checkbox / boolean: accepts booleans and "on" | "true" | "1". Absent means false. */
const formBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "on" || v === "1");

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, ex.: #3d7bff");

const httpsUrl = z
  .url({ protocol: /^https$/, message: "Use uma URL https válida" })
  .max(500);

const toolList = z
  .array(z.string())
  .max(50)
  .refine((ids) => ids.every(isKnownTool), { message: "Ferramenta desconhecida" })
  .transform((ids) => Array.from(new Set(ids)));

export const idSchema = z.uuid({ message: "Identificador inválido" });

// ---------- Departments ----------
export const departmentCreateSchema = z.object({
  name: trimmed(2, 80),
  description: z.string().trim().max(500).default(""),
  color: hexColor.default("#3d7bff"),
});
export type DepartmentCreateInput = z.input<typeof departmentCreateSchema>;

export const departmentUpdateSchema = z.object({
  name: trimmed(2, 80).optional(),
  description: z.string().trim().max(500).optional(),
  color: hexColor.optional(),
});
export type DepartmentUpdateInput = z.input<typeof departmentUpdateSchema>;

export const departmentActiveSchema = z.object({ isActive: formBool });

// ---------- Agents ----------
const agentProfile = {
  departmentId: z.uuid({ message: "Selecione um departamento" }),
  name: trimmed(2, 80),
  title: trimmed(2, 80),
  specialty: trimmed(2, 120),
  description: z.string().trim().max(2000).default(""),
  avatarUrl: z
    .union([z.literal(""), httpsUrl])
    .optional()
    .transform((v) => v || undefined),
};

export const agentCreateSchema = z.object({
  ...agentProfile,
  status: z.enum(AGENT_STATUSES).default("active"),
  instructions: z.string().trim().min(10, "Descreva as instruções (mínimo 10 caracteres)").max(20000),
  allowedTools: toolList.default([]),
  changeNote: z.string().trim().max(500).default("Versão inicial"),
});
export type AgentCreateInput = z.input<typeof agentCreateSchema>;

export const agentUpdateSchema = z.object({
  departmentId: agentProfile.departmentId.optional(),
  name: agentProfile.name.optional(),
  title: agentProfile.title.optional(),
  specialty: agentProfile.specialty.optional(),
  description: z.string().trim().max(2000).optional(),
  avatarUrl: z
    .union([z.literal(""), httpsUrl])
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
});
export type AgentUpdateInput = z.input<typeof agentUpdateSchema>;

export const agentStatusSchema = z.object({ status: z.enum(AGENT_STATUSES) });

export const agentVersionCreateSchema = z.object({
  instructions: z.string().trim().min(10).max(20000),
  allowedTools: toolList.default([]),
  changeNote: z.string().trim().min(3, "Descreva a alteração").max(500),
});
export type AgentVersionCreateInput = z.input<typeof agentVersionCreateSchema>;

// ---------- Tasks ----------
export const taskCreateSchema = z.object({
  title: trimmed(3, 200),
  description: z.string().trim().max(5000).default(""),
  type: z.enum(TASK_TYPE_IDS),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  assignedAgentId: optionalUuid,
  input: z.record(z.string(), z.unknown()).default({}),
  dispatch: formBool,
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  idempotencyKey: optionalText(100, 8),
});
export type TaskCreateInput = z.input<typeof taskCreateSchema>;

export const taskAssignSchema = z.object({ assignedAgentId: z.uuid() });

export const taskListSchema = z.object({
  status: z
    .union([z.literal(""), z.enum(TASK_STATUSES)])
    .optional()
    .transform((v) => v || undefined),
  agentId: optionalUuid,
  departmentId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type TaskListInput = z.input<typeof taskListSchema>;

export const taskCancelSchema = z.object({ reason: z.string().trim().max(500).default("") });

// ---------- Approvals ----------
export const approvalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000).default(""),
  /** Version the user saw; prevents deciding on stale data. */
  expectedVersion: z.coerce.number().int().min(0),
});
export type ApprovalDecisionInput = z.input<typeof approvalDecisionSchema>;

export const approvalListSchema = z.object({
  status: z
    .union([z.literal(""), z.enum(APPROVAL_STATUSES)])
    .optional()
    .transform((v) => v || undefined),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------- Conversations ----------
export const conversationCreateSchema = z
  .object({
    kind: z.enum(CONVERSATION_KINDS),
    title: optionalText(120, 2),
    agentId: optionalUuid,
    departmentId: optionalUuid,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "direct" && !v.agentId)
      ctx.addIssue({ code: "custom", path: ["agentId"], message: "Selecione o funcionário" });
    if (v.kind === "department" && !v.departmentId)
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Selecione o departamento" });
  })
  .transform((v) => ({
    kind: v.kind,
    title: v.title,
    agentId: v.kind === "direct" ? v.agentId : undefined,
    departmentId: v.kind === "department" ? v.departmentId : undefined,
  }));
export type ConversationCreateInput = z.input<typeof conversationCreateSchema>;

export const messageCreateSchema = z.object({
  content: trimmed(1, 5000),
});

// ---------- Audit ----------
export const auditListSchema = z.object({
  entityType: optionalText(50),
  entityId: optionalUuid,
  action: optionalText(80),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------- Auth ----------
export const loginSchema = z.object({
  email: z.email().max(254).transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
});
