/**
 * Agent Registry: resolves the operational identity of an employee for one execution, from the
 * exact agent version the task was dispatched with (instructions are versioned and immutable, so a
 * later edit never changes what a past run received).
 */
import { readAgentAiConfig, type AgentAiConfig } from "@vc/ai/catalog";
import { agents, agentVersions, type DbExecutor, departments } from "@vc/db";
import { eq } from "drizzle-orm";
import { HIERARCHY_LABELS } from "../agent-authority";
import { getTool, type ToolAvailabilityReason } from "../tools";
import { toolAccessFor } from "./tools";

export type AgentIdentity = {
  agentId: string;
  name: string;
  title: string;
  hierarchyLevel: keyof typeof HIERARCHY_LABELS;
  hierarchyLabel: string;
  department: { id: string; name: string };
  specialty: string;
  specialties: string[];
  responsibilities: string[];
  personality: string;
  managerName: string | null;
  /** Current autonomy level (owner setting, read at execution time). */
  autonomyLevel: number;
  /** Concrete tools granted by the version, with the current authorization decision. */
  toolAccess: { id: string; label: string; riskLevel: number; reason: ToolAvailabilityReason }[];
  version: {
    id: string;
    number: number;
    instructions: string;
    allowedTools: { id: string; label: string; status: string }[];
    aiProvider: string | null;
    aiModel: string | null;
    config: AgentAiConfig;
  };
};

export async function loadAgentIdentity(db: DbExecutor, agentId: string, versionId: string | null): Promise<AgentIdentity | null> {
  const [row] = await db
    .select({ agent: agents, department: { id: departments.id, name: departments.name } })
    .from(agents)
    .innerJoin(departments, eq(departments.id, agents.departmentId))
    .where(eq(agents.id, agentId));
  if (!row) return null;
  const vId = versionId ?? row.agent.currentVersionId;
  if (!vId) return null;
  const [version] = await db.select().from(agentVersions).where(eq(agentVersions.id, vId));
  if (!version || version.agentId !== agentId) return null;
  const manager = row.agent.reportsToAgentId
    ? (await db.select({ name: agents.name }).from(agents).where(eq(agents.id, row.agent.reportsToAgentId)))[0]?.name ?? null
    : null;
  return {
    agentId,
    name: row.agent.name,
    title: row.agent.title,
    hierarchyLevel: row.agent.hierarchyLevel,
    hierarchyLabel: HIERARCHY_LABELS[row.agent.hierarchyLevel],
    department: row.department,
    specialty: row.agent.specialty,
    specialties: row.agent.specialties,
    responsibilities: row.agent.responsibilities,
    personality: row.agent.personality,
    managerName: manager,
    autonomyLevel: row.agent.autonomyLevel,
    toolAccess: toolAccessFor(version.allowedTools, row.agent.autonomyLevel),
    version: {
      id: version.id,
      number: version.version,
      instructions: version.instructions,
      allowedTools: version.allowedTools.map((id) => {
        const t = getTool(id);
        return { id, label: t?.label ?? id, status: t?.status ?? "unknown" };
      }),
      aiProvider: version.aiProvider,
      aiModel: version.aiModel,
      config: readAgentAiConfig(version.config),
    },
  };
}
