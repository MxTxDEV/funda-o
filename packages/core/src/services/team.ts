import { type AgentHierarchyLevel, agents, type Department, departments } from "@vc/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { writeAudit } from "../audit";
import { canManage } from "../agent-authority";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { matchZoneByName } from "../office";
import { composeInstructions, TEAM_DEPARTMENTS, TEAM_ROSTER, type TeamDepartmentKey } from "../team-roster";
import { createAgent } from "./agents";
import { createDepartment } from "./departments";

export type TeamSeedResult = {
  createdDepartments: string[];
  reusedDepartments: string[];
  createdAgents: string[];
  adoptedAgents: string[];
  skippedAgents: string[];
  warnings: string[];
};

/** Finds the department that fulfils a team area: same name, or a name matching the area's keywords. */
function findDepartment(all: Department[], key: TeamDepartmentKey): Department | undefined {
  const target = TEAM_DEPARTMENTS[key].name.toLowerCase();
  return all.find((d) => d.name.trim().toLowerCase() === target) ?? all.find((d) => !d.isDemo && matchZoneByName(d.name) === key);
}

/**
 * Registers the initial team (TEAM_ROSTER). Idempotent and conservative:
 * - an employee is identified by its seed key; an existing one is never modified;
 * - an existing employee with the same name in the target department is adopted (only the seed key is set);
 * - existing departments are reused; missing ones are created (audited); inactive ones are reported and skipped.
 */
export async function seedInitialTeam(ctx: ServiceContext): Promise<TeamSeedResult> {
  assertCan(ctx.actor, "agents:write");
  assertCan(ctx.actor, "departments:write");
  const result: TeamSeedResult = { createdDepartments: [], reusedDepartments: [], createdAgents: [], adoptedAgents: [], skippedAgents: [], warnings: [] };

  // 1. Departments
  const all = await ctx.db.select().from(departments);
  const deptByKey = new Map<TeamDepartmentKey, Department>();
  for (const key of Object.keys(TEAM_DEPARTMENTS) as TeamDepartmentKey[]) {
    const needed = TEAM_ROSTER.some((m) => m.department === key);
    if (!needed) continue;
    const found = findDepartment(all, key);
    if (found) {
      deptByKey.set(key, found);
      result.reusedDepartments.push(found.name);
      if (!found.isActive) result.warnings.push(`Departamento "${found.name}" está inativo: seus funcionários não foram cadastrados.`);
    } else {
      const created = await createDepartment(ctx, TEAM_DEPARTMENTS[key]);
      all.push(created);
      deptByKey.set(key, created);
      result.createdDepartments.push(created.name);
    }
  }

  // 2. Employees, managers first so reporting lines can be set at creation time.
  const idByKey = new Map<string, string>();
  const levelByKey = new Map<string, AgentHierarchyLevel>();
  const nameByKey = new Map<string, string>();
  for (const member of TEAM_ROSTER) {
    nameByKey.set(member.key, member.name);
    const [existing] = await ctx.db.select().from(agents).where(eq(agents.seedKey, member.key));
    if (existing) {
      idByKey.set(member.key, existing.id);
      levelByKey.set(member.key, existing.hierarchyLevel);
      result.skippedAgents.push(member.name);
      continue;
    }
    const dept = deptByKey.get(member.department);
    if (!dept || !dept.isActive) {
      result.skippedAgents.push(member.name);
      continue;
    }
    const [sameName] = await ctx.db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.departmentId, dept.id),
          ne(agents.status, "archived"),
          sql`lower(${agents.name}) = ${member.name.toLowerCase()}`,
          sql`${agents.seedKey} IS NULL`,
        ),
      );
    if (sameName) {
      await ctx.db.update(agents).set({ seedKey: member.key }).where(eq(agents.id, sameName.id));
      await writeAudit(ctx.db, ctx.actor, { action: "agent.adopt_seed", entityType: "agent", entityId: sameName.id, changes: { seedKey: member.key } }, ctx.meta);
      idByKey.set(member.key, sameName.id);
      levelByKey.set(member.key, sameName.hierarchyLevel);
      result.adoptedAgents.push(member.name);
      continue;
    }
    let managerId = member.reportsTo ? (idByKey.get(member.reportsTo) ?? null) : null;
    if (member.reportsTo && !managerId) result.warnings.push(`${member.name}: gestor não encontrado; cadastrado sem gestor.`);
    const managerLevel = member.reportsTo ? levelByKey.get(member.reportsTo) : undefined;
    if (managerId && managerLevel && !canManage(managerLevel, member.level)) {
      // An adopted/customized manager keeps its own level; we never change it.
      result.warnings.push(`${member.name}: o gestor previsto (${nameByKey.get(member.reportsTo!)}) tem nível incompatível; cadastrado sem gestor.`);
      managerId = null;
    }
    const agent = await createAgent(
      ctx,
      {
        departmentId: dept.id,
        name: member.name,
        title: member.title,
        specialty: member.specialty,
        description: `${member.title}. ${member.specialty}.`,
        specialties: member.specialties,
        responsibilities: member.responsibilities,
        personality: member.personality,
        hierarchyLevel: member.level,
        reportsToAgentId: managerId,
        appearance: member.appearance,
        instructions: composeInstructions(member, member.reportsTo ? (nameByKey.get(member.reportsTo) ?? null) : null),
        allowedTools: member.tools,
        changeNote: "Versão inicial (equipe inicial)",
      },
      { seedKey: member.key },
    );
    idByKey.set(member.key, agent.id);
    levelByKey.set(member.key, member.level);
    result.createdAgents.push(member.name);
  }

  await writeAudit(ctx.db, ctx.actor, { action: "team.seed", entityType: "system", changes: { ...result } }, ctx.meta);
  return result;
}

/** How many of the initial team members are registered (for the "register initial team" shortcut). */
export async function initialTeamStatus(ctx: ServiceContext) {
  assertCan(ctx.actor, "agents:read");
  const rows = await ctx.db.select({ key: agents.seedKey }).from(agents).where(sql`${agents.seedKey} LIKE 'team:%'`);
  return { registered: rows.length, total: TEAM_ROSTER.length };
}
