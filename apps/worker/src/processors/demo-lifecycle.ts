import { demoLifecycleInputSchema } from "@vc/core";
import { setTimeout as sleep } from "node:timers/promises";
import type { TaskProcessor } from "./types";

const DEMO_NOTICE = "DEMONSTRAÇÃO: nenhum motor de IA foi executado. Resultado gerado pelo processador de teste do ciclo de vida.";

/**
 * DEMONSTRATION PROCESSOR — exercises the lifecycle without producing any "intelligent" output.
 * input: { steps, requireApproval, failTimes }
 */
export const demoLifecycleProcessor: TaskProcessor = async (ctx) => {
  const input = demoLifecycleInputSchema.parse(ctx.task.input);
  const stepMs = Number(process.env.DEMO_PROCESSOR_STEP_MS ?? 1500);

  const granted = ctx.approvals.find((a) => a.status === "approved");
  if (granted) {
    await ctx.progress("Aprovação recebida — finalizando (simulado)", { approvalId: granted.id });
    return {
      kind: "completed",
      result: { demo: true, notice: DEMO_NOTICE, stepsExecuted: input.steps, approvalId: granted.id, approvedAt: granted.decidedAt },
    };
  }

  if (ctx.attempt <= input.failTimes) {
    throw new Error(`Falha simulada na tentativa ${ctx.attempt} (failTimes=${input.failTimes})`);
  }

  for (let step = 1; step <= input.steps; step++) {
    if (await ctx.isAborted()) return { kind: "aborted" };
    await sleep(stepMs);
    await ctx.progress(`Etapa ${step}/${input.steps} concluída (simulada)`, { step, total: input.steps });
  }
  if (await ctx.isAborted()) return { kind: "aborted" };

  const result = { demo: true, notice: DEMO_NOTICE, stepsExecuted: input.steps, attempt: ctx.attempt };
  if (input.requireApproval) {
    return {
      kind: "needs_approval",
      approval: {
        kind: "task_output",
        title: `Aprovar resultado (demo): ${ctx.task.title}`,
        summary: "Solicitação de aprovação gerada pelo processador de demonstração.",
        payload: result,
      },
      partialResult: result,
    };
  }
  return { kind: "completed", result };
};
