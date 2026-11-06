import { agents, closeDb, departments, getDb, tasks, type Database } from "@vc/db";
import { closeRedis, closeTasksQueue } from "@vc/queue";
import { eq, inArray, or } from "drizzle-orm";
import { writeAudit } from "../audit";
import { SYSTEM_ACTOR } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { createAgent } from "../services/agents";
import { createDepartment } from "../services/departments";
import { createTask } from "../services/tasks";

/**
 * DEMONSTRATION DATA. Every row created here has is_demo = true and is shown with a "DEMO" badge.
 * Remove it at any time with `pnpm db:demo:purge`.
 */
const DEMO_DEPARTMENTS = [
  {
    name: "Pesquisa & Inteligência (Demo)",
    description: "Departamento de demonstração: pesquisa de mercado e público.",
    color: "#3d7bff",
    agents: [
      {
        name: "Helena (Demo)",
        title: "Analista de Mercado",
        specialty: "Pesquisa de concorrência",
        tools: ["research.market", "research.audience"],
      },
    ],
  },
  {
    name: "Criação & Copy (Demo)",
    description: "Departamento de demonstração: copywriting e briefing criativo.",
    color: "#22d3ee",
    agents: [
      { name: "Rafael (Demo)", title: "Copywriter Sênior", specialty: "Copy de resposta direta", tools: ["content.copywriting"] },
      { name: "Lia (Demo)", title: "Diretora de Arte", specialty: "Briefing de criativos", tools: ["creative.briefing"] },
    ],
  },
  {
    name: "Performance (Demo)",
    description: "Departamento de demonstração: planejamento de campanhas (sem publicação nem gastos).",
    color: "#a78bfa",
    agents: [
      {
        name: "Bruno (Demo)",
        title: "Gestor de Tráfego",
        specialty: "Planejamento de campanhas Meta Ads",
        tools: ["campaigns.plan", "analytics.meta_ads.read"],
      },
    ],
  },
];

export async function seedDemo(db: Database) {
  const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.isDemo, true)).limit(1);
  if (existing.length) return { skipped: true as const };

  const ctx: ServiceContext = { db, actor: SYSTEM_ACTOR };
  const createdAgents: string[] = [];
  for (const d of DEMO_DEPARTMENTS) {
    const dept = await createDepartment(ctx, { name: d.name, description: d.description, color: d.color }, { isDemo: true });
    for (const a of d.agents) {
      const agent = await createAgent(
        ctx,
        {
          departmentId: dept.id,
          name: a.name,
          title: a.title,
          specialty: a.specialty,
          description: "Funcionário de demonstração. Não executa IA nesta fase.",
          instructions: `Você é ${a.title}. (Instruções de demonstração — o motor de IA ainda não está integrado.)`,
          allowedTools: a.tools,
          changeNote: "Versão inicial (demo)",
        },
        { isDemo: true },
      );
      createdAgents.push(agent.id);
    }
  }
  await createTask(
    ctx,
    {
      title: "Tarefa de demonstração — ciclo de vida",
      description: "Use 'Enviar para a fila' para ver o worker processar esta tarefa de demonstração.",
      type: "demo.lifecycle",
      assignedAgentId: createdAgents[0],
      input: { steps: 3, requireApproval: true },
    },
    { isDemo: true },
  );
  return { skipped: false as const, agents: createdAgents.length };
}

export async function purgeDemo(db: Database) {
  return db.transaction(async (tx) => {
    const demoAgents = await tx.select({ id: agents.id }).from(agents).where(eq(agents.isDemo, true));
    const agentIds = demoAgents.map((a) => a.id);
    const deletedTasks = await tx
      .delete(tasks)
      .where(agentIds.length ? or(eq(tasks.isDemo, true), inArray(tasks.assignedAgentId, agentIds)) : eq(tasks.isDemo, true))
      .returning({ id: tasks.id });
    const deletedAgents = agentIds.length
      ? await tx.delete(agents).where(inArray(agents.id, agentIds)).returning({ id: agents.id })
      : [];
    // Demo departments that now contain real agents are kept (and reported).
    const demoDepts = await tx.query.departments.findMany({ where: eq(departments.isDemo, true), with: { agents: { columns: { id: true } } } });
    const removable = demoDepts.filter((d) => d.agents.length === 0).map((d) => d.id);
    if (removable.length) await tx.delete(departments).where(inArray(departments.id, removable));
    const summary = {
      tasks: deletedTasks.length,
      agents: deletedAgents.length,
      departments: removable.length,
      keptDepartments: demoDepts.length - removable.length,
    };
    await writeAudit(tx, SYSTEM_ACTOR, { action: "demo.purge", entityType: "system", changes: summary });
    return summary;
  });
}

export async function closeAll() {
  await closeTasksQueue();
  await closeRedis();
  await closeDb();
}

export { getDb };
