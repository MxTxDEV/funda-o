import { agents, tasks, TASK_STATUSES } from "@vc/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { defineTool } from "./types";

/** Read-only lookup of the company's tasks and produced results (same department by default). */
export const tasksLookup = defineTool({
  modelDescription:
    "Consulta tarefas da empresa e trechos dos resultados já produzidos (somente leitura). Útil para reaproveitar pesquisas e entregas anteriores.",
  inputSchema: z.object({
    query: z.string().max(120).optional().describe("Texto a procurar no título ou descrição"),
    status: z.enum(TASK_STATUSES).optional(),
    scope: z.enum(["department", "company"]).default("department"),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  async run(input, ctx) {
    const like = input.query ? `%${input.query.replace(/[%_]/g, "")}%` : null;
    const rows = await ctx.db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, result: tasks.result, updatedAt: tasks.updatedAt, agentName: agents.name })
      .from(tasks)
      .leftJoin(agents, eq(agents.id, tasks.assignedAgentId))
      .where(
        and(
          input.scope === "department" && ctx.departmentId ? eq(tasks.departmentId, ctx.departmentId) : undefined,
          input.status ? eq(tasks.status, input.status) : undefined,
          like ? or(ilike(tasks.title, like), ilike(tasks.description, like)) : undefined,
          ctx.taskId ? undefined : undefined,
        ),
      )
      .orderBy(desc(tasks.updatedAt))
      .limit(input.limit);
    const items = rows
      .filter((r) => r.id !== ctx.taskId)
      .map((r) => {
        const output = typeof r.result?.output === "string" ? (r.result.output as string).slice(0, 1200) : null;
        return { id: r.id, title: r.title, status: r.status, agent: r.agentName, updatedAt: r.updatedAt.toISOString(), outputExcerpt: output };
      });
    return {
      summary: `${items.length} tarefa(s) encontradas`,
      content: items.length
        ? items.map((t) => `- [${t.status}] ${t.title} (${t.agent ?? "sem responsável"}, ${t.updatedAt})${t.outputExcerpt ? `\n  Trecho do resultado: ${t.outputExcerpt}` : ""}`).join("\n")
        : "Nenhuma tarefa encontrada.",
      data: { items },
    };
  },
});
