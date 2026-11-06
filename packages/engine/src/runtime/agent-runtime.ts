import {
  type ChatBlock,
  type ChatMessage,
  type ChatResult,
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
import { buildToolSpecs, expandToolGrants, type GatewayDeps, ToolGateway } from "../tools/gateway";
import { toolIdFor } from "../tools/registry";
import { buildAgentPrompt } from "./prompt";

const RESULT_NOTICE =
  "Conteúdo gerado por IA a partir do conhecimento do modelo, sem consulta a fontes externas nesta execução. Fatos devem ser verificados antes de qualquer uso externo.";
const RESULT_NOTICE_WITH_SOURCES =
  "Conteúdo gerado por IA com apoio de ferramentas. As fontes consultadas estão listadas na tarefa; confira-as antes de qualquer uso externo.";

/** Permanent failure: retrying cannot help (configuration, limits, rejected request). */
function permanent(message: string): never {
  throw new UnrecoverableError(message);
}

export type RuntimeDeps = { registry?: ProviderRegistry; abortPollMs?: number; tools?: GatewayDeps };

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

  // ---- tools offered to the model (Tool Registry + autonomy) and prompt
  const toolSpecs = buildToolSpecs(identity);
  const availableToolIds = toolSpecs.map((t) => toolIdFor(t.name));
  const prompt = buildAgentPrompt(identity, task, availableToolIds);

  // ---- execution record (idempotent per task/run/attempt)
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
  await ctx.progress(`${identity.name} está executando com ${provider.label} · ${aiModel}`, { agentRunId: run.id, model: aiModel, tools: availableToolIds });

  // ---- provider calls (tool loop) with cancellation polling
  const controller = new AbortController();
  const poll = setInterval(() => {
    ctx
      .isAborted()
      .then((aborted) => aborted && controller.abort())
      .catch(() => undefined);
  }, deps.abortPollMs ?? 2000);

  const gateway = new ToolGateway(
    { db, identity, taskId: task.id, departmentId: task.departmentId, agentRunId: run.id, signal: controller.signal, grants: expandToolGrants(identity.version.allowedTools.map((t) => t.id)) },
    deps.tools,
  );
  const messages: ChatMessage[] = [...prompt.messages];
  const usage = { inputTokens: 0, outputTokens: 0, reported: false };
  let last: ChatResult | null = null;
  const maxRounds = toolSpecs.length ? readMaxToolRounds() : 0;

  const usageFields = () => ({
    inputTokens: usage.reported ? usage.inputTokens : null,
    outputTokens: usage.reported ? usage.outputTokens : null,
    costUsd: usage.reported ? estimateCostUsd(price, usage) : null,
  });

  try {
    for (let round = 0; ; round++) {
      const res = await provider.chat({
        model: aiModel,
        system: prompt.system,
        messages,
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
        tools: toolSpecs.length ? toolSpecs : undefined,
        signal: controller.signal,
        timeoutMs: company.requestTimeoutMs,
      });
      last = res;
      if (res.usage) {
        usage.reported = true;
        usage.inputTokens += res.usage.inputTokens;
        usage.outputTokens += res.usage.outputTokens;
      }
      if (res.toolCalls.length === 0 || round >= maxRounds) break;

      messages.push({
        role: "assistant",
        content: [...(res.text ? [{ type: "text" as const, text: res.text }] : []), ...res.toolCalls.map((c) => ({ type: "tool_call" as const, ...c }))],
      });
      const results: ChatBlock[] = [];
      for (const call of res.toolCalls) {
        if (controller.signal.aborted) throw new ProviderError(provider.id, "aborted");
        await ctx.progress(`${identity.name} usou a ferramenta ${toolIdFor(call.name)}`, { toolId: toolIdFor(call.name) });
        const r = await gateway.execute(call);
        results.push({ type: "tool_result", toolCallId: call.id, content: r.content, isError: r.isError });
      }
      if (round + 1 >= maxRounds) {
        results.push({ type: "text", text: "Limite de uso de ferramentas desta execução atingido. Produza agora a resposta final, sem chamar ferramentas." });
      }
      messages.push({ role: "user", content: results });
    }

    const res = last!;
    const toolsUsed = [...gateway.used];
    const { costUsd } = usageFields();
    if (!res.text.trim()) {
      await finishAgentRun(db, run.id, {
        status: "failed",
        responseModel: res.model,
        ...usageFields(),
        finishReason: res.finishReason,
        providerRequestId: res.requestId,
        toolsUsed,
        error: { kind: "empty_output", message: "O modelo não retornou texto." },
      });
      permanent("O modelo não retornou texto.");
    }
    await finishAgentRun(db, run.id, {
      status: "succeeded",
      responseModel: res.model,
      ...usageFields(),
      finishReason: res.finishReason,
      providerRequestId: res.requestId,
      toolsUsed,
    });
    logger.info("agent.run_succeeded", { taskId: task.id, agentRunId: run.id, model: res.model, usage, costUsd, toolsUsed });

    const result = {
      kind: "agent_output",
      format: "markdown",
      output: res.text,
      truncated: res.finishReason === "max_tokens",
      agent: { id: identity.agentId, name: identity.name, title: identity.title, version: identity.version.number },
      provider: aiProvider,
      model: res.model,
      usage: usage.reported ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } : null,
      costUsd,
      agentRunId: run.id,
      toolCalls: gateway.calls,
      sources: gateway.sources.map((s) => ({ kind: s.kind, url: s.url, title: s.title })),
      notice: gateway.sources.length ? RESULT_NOTICE_WITH_SOURCES : RESULT_NOTICE,
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
    const toolsUsed = [...gateway.used];
    if (err instanceof ProviderError && err.kind === "aborted") {
      await finishAgentRun(db, run.id, { status: "aborted", ...usageFields(), toolsUsed, error: { kind: "aborted", message: "Interrompida: tarefa cancelada" } });
      return { kind: "aborted" };
    }
    const pe = err instanceof ProviderError ? err : null;
    await finishAgentRun(db, run.id, {
      status: "failed",
      ...usageFields(),
      toolsUsed,
      providerRequestId: pe?.requestId ?? null,
      error: { kind: pe?.kind ?? "internal", message: (err instanceof Error ? err.message : String(err)).slice(0, 500), status: pe?.status ?? null, retryable: pe?.retryable ?? false },
    });
    if (pe && !pe.retryable) throw new UnrecoverableError(pe.message);
    throw err;
  } finally {
    clearInterval(poll);
  }
}

function readMaxToolRounds() {
  const n = Number(process.env.AI_MAX_TOOL_ROUNDS ?? 6);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 12) : 6;
}
