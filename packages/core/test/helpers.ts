import { getDb, users } from "@vc/db";
import { getRedis, getTasksQueue } from "@vc/queue";
import { sql } from "drizzle-orm";
import type { UserRole } from "@vc/db/values";
import { createAgent, createDepartment, hashPassword, type ServiceContext, type UserActor } from "../src";

export const db = () => getDb();

export async function resetState() {
  await getDb().execute(
    sql`TRUNCATE rate_limits, department_office_zones, users, departments, agents, agent_versions, tasks, task_events, approvals, conversations, messages, audit_logs, agent_presence, agent_runs, ai_provider_checks RESTART IDENTITY CASCADE`,
  );
  await getTasksQueue().obliterate({ force: true });
  const keys = await getRedis().keys("vc:rl:*");
  if (keys.length) await getRedis().del(...keys);
}

let passwordHash: string | undefined;

export async function makeUser(role: UserRole = "owner", email = `${role}-${Math.random().toString(36).slice(2)}@test.dev`) {
  passwordHash ??= await hashPassword("Correct-Horse-9");
  const [u] = await getDb().insert(users).values({ email, name: role, role, passwordHash }).returning();
  return u!;
}

export async function ctxFor(role: UserRole = "owner"): Promise<ServiceContext & { actor: UserActor }> {
  const u = await makeUser(role);
  return { db: getDb(), actor: { type: "user", userId: u.id, email: u.email, role } };
}

export async function makeAgent(ctx: ServiceContext, overrides: { status?: "active" | "paused" } = {}) {
  const dept = await createDepartment(ctx, { name: `Dept ${Math.random().toString(36).slice(2, 8)}` });
  const agent = await createAgent(ctx, {
    departmentId: dept.id,
    name: "Agente Teste",
    title: "Analista",
    specialty: "Testes",
    instructions: "Instruções de teste do agente.",
    allowedTools: ["research.market"],
    status: overrides.status ?? "active",
  });
  return { dept, agent };
}
