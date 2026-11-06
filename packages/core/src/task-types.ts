import { z } from "zod";

/**
 * Registry of task types the worker knows how to execute.
 * FOUNDATION ships only a demonstration processor: it exercises the full lifecycle
 * (queue → progress → approval → completion / retries / failure) without running any AI.
 */
export const demoLifecycleInputSchema = z.object({
  steps: z.coerce.number().int().min(1).max(10).default(3),
  requireApproval: z.coerce.boolean().default(false),
  /** Number of attempts that fail on purpose before succeeding (tests retries). */
  failTimes: z.coerce.number().int().min(0).max(5).default(0),
});
export type DemoLifecycleInput = z.infer<typeof demoLifecycleInputSchema>;

/** Real AI execution by the assigned employee (Agent Runtime). The task title/description is the request. */
export const agentExecuteInputSchema = z.object({
  /** When true, the owner must approve the generated result before the task is completed. */
  requireApproval: z.coerce.boolean().default(false),
});
export type AgentExecuteInput = z.infer<typeof agentExecuteInputSchema>;

export const TASK_TYPES = {
  "agent.execute": {
    label: "Execução por IA — funcionário responsável",
    description:
      "O funcionário responsável executa a tarefa com o modelo de IA configurado na versão atual dele. O resultado é um rascunho para análise do proprietário: nenhuma ação externa é executada.",
    demo: false,
    inputSchema: agentExecuteInputSchema,
  },
  "demo.lifecycle": {
    label: "Demonstração — ciclo de vida da tarefa",
    description:
      "Processador de demonstração. Não executa IA: percorre etapas simuladas para validar fila, progresso, aprovação, tentativas e falhas.",
    demo: true,
    inputSchema: demoLifecycleInputSchema,
  },
} as const;

export type TaskType = keyof typeof TASK_TYPES;
export const TASK_TYPE_IDS = Object.keys(TASK_TYPES) as [TaskType, ...TaskType[]];

export function isTaskType(value: string): value is TaskType {
  return value in TASK_TYPES;
}
