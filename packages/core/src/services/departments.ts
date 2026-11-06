import { agents, type Department, departments } from "@vc/db";
import { asc, count, eq, sql } from "drizzle-orm";
import { diff, writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { conflict, notFound } from "../errors";
import {
  type DepartmentCreateInput,
  departmentCreateSchema,
  type DepartmentUpdateInput,
  departmentUpdateSchema,
  idSchema,
} from "../validation";

export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "departamento"
  );
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
export { isUniqueViolation };

export async function listDepartments(ctx: ServiceContext, opts: { activeOnly?: boolean } = {}) {
  assertCan(ctx.actor, "departments:read");
  const agentCount = ctx.db
    .select({ departmentId: agents.departmentId, total: count().as("total") })
    .from(agents)
    .where(sql`${agents.status} <> 'archived'`)
    .groupBy(agents.departmentId)
    .as("agent_count");

  const rows = await ctx.db
    .select({ department: departments, agentCount: sql<number>`coalesce(${agentCount.total}, 0)::int` })
    .from(departments)
    .leftJoin(agentCount, eq(agentCount.departmentId, departments.id))
    .where(opts.activeOnly ? eq(departments.isActive, true) : undefined)
    .orderBy(asc(departments.name));
  return rows.map((r) => ({ ...r.department, agentCount: r.agentCount }));
}

export async function getDepartment(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, "departments:read");
  const department = await ctx.db.query.departments.findFirst({
    where: eq(departments.id, idSchema.parse(id)),
    with: { agents: { with: { presence: true }, orderBy: (a, { asc }) => [asc(a.name)] } },
  });
  if (!department) throw notFound("Departamento");
  return department;
}

export async function createDepartment(
  ctx: ServiceContext,
  raw: DepartmentCreateInput,
  opts: { isDemo?: boolean } = {},
): Promise<Department> {
  assertCan(ctx.actor, "departments:write");
  const input = departmentCreateSchema.parse(raw);
  try {
    return await ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(departments)
        .values({
          ...input,
          slug: slugify(input.name),
          isDemo: opts.isDemo ?? false,
          createdById: ctx.actor.type === "user" ? ctx.actor.userId : null,
        })
        .returning();
      if (!created) throw new Error("insert failed");
      await writeAudit(
        tx,
        ctx.actor,
        { action: "department.create", entityType: "department", entityId: created.id, changes: input },
        ctx.meta,
      );
      return created;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("Já existe um departamento com este nome.");
    throw err;
  }
}

export async function updateDepartment(ctx: ServiceContext, id: string, raw: DepartmentUpdateInput) {
  assertCan(ctx.actor, "departments:write");
  const input = departmentUpdateSchema.parse(raw);
  const deptId = idSchema.parse(id);
  try {
    return await ctx.db.transaction(async (tx) => {
      const [current] = await tx.select().from(departments).where(eq(departments.id, deptId)).for("update");
      if (!current) throw notFound("Departamento");
      const patch = { ...input, ...(input.name ? { slug: slugify(input.name) } : {}) };
      const [updated] = await tx.update(departments).set(patch).where(eq(departments.id, deptId)).returning();
      await writeAudit(
        tx,
        ctx.actor,
        { action: "department.update", entityType: "department", entityId: deptId, changes: diff(current, patch) },
        ctx.meta,
      );
      return updated!;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("Já existe um departamento com este nome.");
    throw err;
  }
}

export async function setDepartmentActive(ctx: ServiceContext, id: string, isActive: boolean) {
  assertCan(ctx.actor, "departments:write");
  const deptId = idSchema.parse(id);
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(departments).where(eq(departments.id, deptId)).for("update");
    if (!current) throw notFound("Departamento");
    if (current.isActive === isActive) return current;
    const [updated] = await tx.update(departments).set({ isActive }).where(eq(departments.id, deptId)).returning();
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: isActive ? "department.activate" : "department.deactivate",
        entityType: "department",
        entityId: deptId,
        changes: { isActive: { from: current.isActive, to: isActive } },
      },
      ctx.meta,
    );
    return updated!;
  });
}
