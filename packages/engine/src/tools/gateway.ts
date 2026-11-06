import type { ToolCall, ToolSpec } from "@vc/ai";
import {
  type AgentIdentity,
  countToolCallsToday,
  expandToolGrants,
  getToolDefinition,
  logger,
  recordToolExecution,
  saveResearchSources,
  toolAvailability,
  TOOL_AVAILABILITY_LABELS,
} from "@vc/core";
import { agents, type Database } from "@vc/db";
import { eq } from "drizzle-orm";
import { lookup as dnsLookup } from "node:dns/promises";
import { z } from "zod";
import { TOOL_HANDLERS, toolIdFor, toolNameFor } from "./registry";
import { ToolError, type LookupFn, type ToolSource } from "./types";

export type GatewayDeps = {
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  lookup?: LookupFn;
  env?: Record<string, string | undefined>;
};

/** Tool specs offered to the model: only granted, available, configured tools within the employee's autonomy. */
export function buildToolSpecs(identity: AgentIdentity): ToolSpec[] {
  return identity.toolAccess
    .filter((t) => t.reason === "ok" && TOOL_HANDLERS[t.id])
    .map((t) => {
      const handler = TOOL_HANDLERS[t.id]!;
      const schema = z.toJSONSchema(handler.inputSchema, { io: "input" }) as Record<string, unknown>;
      delete schema.$schema;
      return { name: toolNameFor(t.id), description: handler.modelDescription, inputSchema: schema };
    });
}

export type GatewayCallResult = { toolId: string; content: string; isError: boolean; status: "succeeded" | "failed" | "denied" };

/**
 * Tool Gateway: the only path from a model's tool call to a handler. Re-checks authorization with the
 * employee's CURRENT autonomy level, validates input, enforces per-run and per-day limits, executes
 * with cancellation and logs every call (including denials).
 */
export class ToolGateway {
  private readonly perRun = new Map<string, number>();
  readonly used = new Set<string>();
  readonly sources: ToolSource[] = [];
  readonly calls: { toolId: string; status: string; summary: string }[] = [];

  constructor(
    private readonly ctx: {
      db: Database;
      identity: AgentIdentity;
      taskId: string;
      departmentId: string | null;
      agentRunId: string;
      signal: AbortSignal;
      grants: string[];
    },
    private readonly deps: GatewayDeps = {},
  ) {}

  private async deny(toolId: string, input: Record<string, unknown>, reason: string, message: string): Promise<GatewayCallResult> {
    await recordToolExecution(this.ctx.db, {
      toolId,
      agentRunId: this.ctx.agentRunId,
      taskId: this.ctx.taskId,
      agentId: this.ctx.identity.agentId,
      status: "denied",
      input,
      denialReason: reason,
      summary: message,
    });
    this.calls.push({ toolId, status: "denied", summary: message });
    return { toolId, content: `Chamada recusada: ${message}`, isError: true, status: "denied" };
  }

  async execute(call: ToolCall): Promise<GatewayCallResult> {
    const toolId = toolIdFor(call.name);
    const def = getToolDefinition(toolId);
    const handler = TOOL_HANDLERS[toolId];
    if (!def || !handler) return this.deny(call.name.slice(0, 80), call.input, "unknown_tool", "ferramenta inexistente.");

    // Current autonomy (the owner may have lowered it during the run).
    const [row] = await this.ctx.db.select({ autonomyLevel: agents.autonomyLevel, status: agents.status }).from(agents).where(eq(agents.id, this.ctx.identity.agentId));
    if (!row || row.status !== "active") return this.deny(toolId, call.input, "agent_inactive", "funcionário inativo.");
    const reason = toolAvailability(toolId, { grants: this.ctx.grants, autonomyLevel: row.autonomyLevel, configuredEnv: (n) => !!(this.deps.env ?? process.env)[n]?.trim() });
    if (reason !== "ok") return this.deny(toolId, call.input, reason, TOOL_AVAILABILITY_LABELS[reason]);

    const runCount = this.perRun.get(toolId) ?? 0;
    if (runCount >= def.limits.perRun) return this.deny(toolId, call.input, "limit_per_run", `limite de ${def.limits.perRun} usos por execução atingido.`);
    if ((await countToolCallsToday(this.ctx.db, this.ctx.identity.agentId, toolId)) >= def.limits.perDayPerAgent) {
      return this.deny(toolId, call.input, "limit_per_day", `limite diário de ${def.limits.perDayPerAgent} usos atingido.`);
    }
    const parsed = handler.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ");
      return this.deny(toolId, call.input, "invalid_input", `parâmetros inválidos (${issues.slice(0, 300)}).`);
    }
    this.perRun.set(toolId, runCount + 1);
    this.used.add(toolId);

    const started = new Date();
    const input = parsed.data as Record<string, unknown>;
    try {
      const out = await handler.run(parsed.data, {
        db: this.ctx.db,
        taskId: this.ctx.taskId,
        agentId: this.ctx.identity.agentId,
        departmentId: this.ctx.departmentId,
        signal: this.ctx.signal,
        fetch: this.deps.fetch ?? ((u, i) => fetch(u, i)),
        lookup: this.deps.lookup ?? ((h) => dnsLookup(h, { all: true })),
        env: this.deps.env ?? process.env,
      });
      const exec = await recordToolExecution(this.ctx.db, {
        toolId,
        agentRunId: this.ctx.agentRunId,
        taskId: this.ctx.taskId,
        agentId: this.ctx.identity.agentId,
        status: "succeeded",
        input,
        summary: out.summary,
        output: out.data,
        durationMs: Date.now() - started.getTime(),
        startedAt: started,
      });
      if (out.sources?.length) {
        await saveResearchSources(
          this.ctx.db,
          out.sources.map((s) => ({ ...s, taskId: this.ctx.taskId, toolExecutionId: exec.id, agentId: this.ctx.identity.agentId })),
        );
        this.sources.push(...out.sources);
      }
      this.calls.push({ toolId, status: "succeeded", summary: out.summary });
      return { toolId, content: out.content, isError: false, status: "succeeded" };
    } catch (err) {
      const expected = err instanceof ToolError;
      const message = expected ? (err as Error).message : "erro interno da ferramenta.";
      if (!expected) logger.error("tool.unexpected_error", { toolId, err });
      await recordToolExecution(this.ctx.db, {
        toolId,
        agentRunId: this.ctx.agentRunId,
        taskId: this.ctx.taskId,
        agentId: this.ctx.identity.agentId,
        status: "failed",
        input,
        error: message,
        summary: message,
        durationMs: Date.now() - started.getTime(),
        startedAt: started,
      });
      this.calls.push({ toolId, status: "failed", summary: message });
      return { toolId, content: `A ferramenta falhou: ${message}`, isError: true, status: "failed" };
    }
  }
}

export { expandToolGrants };
