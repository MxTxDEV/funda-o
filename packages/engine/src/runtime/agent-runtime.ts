import {
  estimateCostUsd,
  getProviderRegistry,
  priceFor,
  ProviderError,
  readCompanyAiLimits,
  type ProviderRegistry,
} from "@vc/ai";
import {
  agentExecuteInputSchema,
  approvalCoversContent,
  finishAgentRun,
  loadAgentIdentity,
  logger,
  startAgentRun,
  usageToday,
} from "@vc/core";
import { UnrecoverableError } from "bullmq";
import type { ProcessorContext, ProcessorOutcome } from "../processors/types";
import { buildAgentPrompt } from "./prompt";

const RESULT_NOTICE =
  "Conteúdo gerado por IA a partir do conhecimento do modelo, sem acesso à internet ou a dados da empresa. Fatos devem ser verificados antes de qualquer uso externo.";

/** Permanent failure: retrying cannot help (configuration, limits, rejected request). */
function permanent(message: string): never {
  throw new UnrecoverableError(message);
}

export type RuntimeDeps = { registry?: ProviderRegistry; abortPollMs?: number };

/**
 * Agent Runtime: executes one task with the assigned employee's configured model.
 * Responsibilities: identity (Agent Registry), limits, provider call with timeout/cancellation,
 * execution record (tokens, cost, duration) and result. Delegation and tools come in later phases.
 */
export async function runAgentTask(ctx: ProcessorContext, deps: RuntimeDeps = {}): Promise<ProcessorOutcome> {
  const { db, task } = ctx;
  const input = agentExecuteInputSchema.parse(task.input ?? {});

  // Resumed after the owner's decision: the approval must cover exactly the stored result.
  const granted = ctx.approvals.find((a) => a.status === "approved");
  if (granted) {
    if (!task.result || !approvalCoversContent(granted, task.result)) {
      permanent("O conteúdo mudou depois da aprovação: é necessária uma nova aprovação.");
    }
    await ctx.progress("Aprovação do proprietário confirmada para este conteúdo", { approvalId: granted.id });
    return { kind: "completed", result: { ...task.result, approval: { id: granted.id, decidedAt: granted.decidedAt } } };
  }

  if (!ctx.agent) permanent("Tarefa sem funcionário responsável.");
  const identity = await loadAgentIdentity(db, ctx.agent.id, task.agentVersionId);
  if (!identity) permanent("Versão do funcionário não encontrada.");
  const { aiProvider, aiModel, config } = identity.version;
  if (!aiProvider || !aiModel) {
    permanent(`${identity.name} não tem provedor e modelo de IA configurados na versão ${identity.version.number}.`);
  }

  const registry = deps.registry ?? getProviderRegistry();
  const provider = registry.get(aiProvider);
  if (!provider.isConfigured()) permanent(new ProviderError(provider.id, "not_configured").message);

  // ---- limits (company and employee)
  const company = readCompanyAiLimits();
  if (!company.enabled) permanent("Execução de IA desativada pela empresa (AI_EXECUTION_ENABLED=false).");
  const price = priceFor(aiProvider, aiModel);
  const [companyUsage, agentUsage] = await Promise.all([usageToday(db), usageToday(db, { agentId: identity.agentId })]);
  if (company.dailyTokenLimit !== null && companyUsage.tokens >= company.dailyTokenLimit) {
    permanent(`Limite diário de tokens da empresa atingido (${company.dailyTokenLimit}).`);
  }
  if (company.dailyCostLimitUsd !== null) {
    if (!price) permanent(`Limite de custo da empresa configurado, mas não há preço configurado para ${aiProvider}/${aiModel}.`);
    if (companyUsage.costUsd >= company.dailyCostLimitUsd) permanent(`Limite diário de custo da empresa atingido (US$ ${company.dailyCostLimitUsd}).`);
  }
  if (config.dailyTokenLimit !== undefined && agentUsage.tokens >= config.dailyTokenLimit) {
    permanent(`Limite diário de tokens de ${identity.name} atingido (${config.dailyTokenLimit}).`);
  }
  if (config.dailyCostLimitUsd !== undefined) {
    if (!price) permanent(`Limite de custo de ${identity.name} configurado, mas não há preço configurado para ${aiProvider}/${aiModel}.`);
    if (agentUsage.costUsd >= config.dailyCostLimitUsd) permanent(`Limite diário de custo de ${identity.name} atingido (US$ ${config.dailyCostLimitUsd}).`);
  }

  // ---- execution record (idempotent per task/run/attempt)
  const prompt = buildAgentPrompt(identity, task);
  const { run, created } = await startAgentRun(db, {
    taskId: task.id,
    runNumber: task.runCount,
    attempt: ctx.attempt,
    agentId: identity.agentId,
    agentVersionId: identity.version.id,
    provider: aiProvider,
    model: aiModel,
    promptHash: prompt.promptHash,
  });
  if (!created) throw new Error("Esta tentativa já foi registrada por outra execução; aguardando nova tentativa.");
  await ctx.progress(`${identity.name} está executando com ${provider.label} · ${aiModel}`, { agentRunId: run.id, model: aiModel });

  // ---- provider call with cancellation polling
  const controller = new AbortController();
  const poll = setInterval(() => {
    ctx
      .isAborted()
      .then((aborted) => aborted && controller.abort())
      .catch(() => undefined);
  }, deps.abortPollMs ?? 2000);

  try {
    const res = await provider.chat({
      model: aiModel,
      system: prompt.system,
      messages: prompt.messages,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      signal: controller.signal,
      timeoutMs: company.requestTimeoutMs,
    });
    const costUsd = estimateCostUsd(price, res.usage);
    if (!res.text.trim()) {
      await finishAgentRun(db, run.id, {
        status: "failed",
        responseModel: res.model,
        inputTokens: res.usage?.inputTokens ?? null,
        outputTokens: res.usage?.outputTokens ?? null,
        costUsd,
        finishReason: res.finishReason,
        providerRequestId: res.requestId,
        error: { kind: "empty_output", message: "O modelo não retornou texto." },
      });
      permanent("O modelo não retornou texto.");
    }
    await finishAgentRun(db, run.id, {
      status: "succeeded",
      responseModel: res.model,
      inputTokens: res.usage?.inputTokens ?? null,
      outputTokens: res.usage?.outputTokens ?? null,
      costUsd,
      finishReason: res.finishReason,
      providerRequestId: res.requestId,
      toolsUsed: [],
    });
    logger.info("agent.run_succeeded", { taskId: task.id, agentRunId: run.id, model: res.model, usage: res.usage, costUsd });

    const result = {
      kind: "agent_output",
      format: "markdown",
      output: res.text,
      truncated: res.finishReason === "max_tokens",
      agent: { id: identity.agentId, name: identity.name, title: identity.title, version: identity.version.number },
      provider: aiProvider,
      model: res.model,
      usage: res.usage,
      costUsd,
      agentRunId: run.id,
      notice: RESULT_NOTICE,
    };
    if (input.requireApproval) {
      return {
        kind: "needs_approval",
        approval: {
          kind: "agent_output",
          title: `Aprovar resultado de ${identity.name}: ${task.title}`,
          summary: "Revise o conteúdo gerado. A aprovação vale somente para este conteúdo exato.",
          payload: result,
        },
        partialResult: result,
      };
    }
    return { kind: "completed", result };
  } catch (err) {
    if (err instanceof UnrecoverableError) throw err;
    if (err instanceof ProviderError && err.kind === "aborted") {
      await finishAgentRun(db, run.id, { status: "aborted", error: { kind: "aborted", message: "Interrompida: tarefa cancelada" } });
      return { kind: "aborted" };
    }
    const pe = err instanceof ProviderError ? err : null;
    await finishAgentRun(db, run.id, {
      status: "failed",
      providerRequestId: pe?.requestId ?? null,
      error: { kind: pe?.kind ?? "internal", message: (err instanceof Error ? err.message : String(err)).slice(0, 500), status: pe?.status ?? null, retryable: pe?.retryable ?? false },
    });
    if (pe && !pe.retryable) throw new UnrecoverableError(pe.message);
    throw err;
  } finally {
    clearInterval(poll);
  }
}
