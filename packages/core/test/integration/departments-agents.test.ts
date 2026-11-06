import { agentPresence, auditLogs } from "@vc/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AppError,
  createAgent,
  createAgentVersion,
  createDepartment,
  getAgent,
  listDepartments,
  setAgentStatus,
  setDepartmentActive,
  updateDepartment,
} from "../../src";
import { ctxFor, db, makeAgent, resetState } from "../helpers";

beforeEach(resetState);

describe("departments", () => {
  it("creates, updates, toggles and audits", async () => {
    const ctx = await ctxFor("admin");
    const dept = await createDepartment(ctx, { name: "Pesquisa de Mercado", description: "Pesquisas" });
    expect(dept.slug).toBe("pesquisa-de-mercado");
    await updateDepartment(ctx, dept.id, { description: "Nova descrição" });
    await setDepartmentActive(ctx, dept.id, false);

    const list = await listDepartments(ctx);
    expect(list).toHaveLength(1);
    expect(list[0]!.isActive).toBe(false);
    expect(list[0]!.agentCount).toBe(0);

    const logs = await db().select().from(auditLogs).where(eq(auditLogs.entityId, dept.id));
    expect(logs.map((l) => l.action).sort()).toEqual(["department.create", "department.deactivate", "department.update"]);
    expect(logs.every((l) => l.actorUserId === ctx.actor.userId)).toBe(true);
  });

  it("rejects duplicate names with a conflict", async () => {
    const ctx = await ctxFor("admin");
    await createDepartment(ctx, { name: "Copy" });
    await expect(createDepartment(ctx, { name: "copy" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces backend authorization", async () => {
    const viewer = await ctxFor("viewer");
    await expect(createDepartment(viewer, { name: "Hack" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("agents", () => {
  it("creates an agent with version 1 and idle presence", async () => {
    const ctx = await ctxFor("admin");
    const { agent } = await makeAgent(ctx);
    const full = await getAgent(ctx, agent.id);
    expect(full.versions).toHaveLength(1);
    expect(full.currentVersion?.version).toBe(1);
    expect(full.presence?.state).toBe("idle");
  });

  it("creates new versions instead of mutating instructions", async () => {
    const ctx = await ctxFor("admin");
    const { agent } = await makeAgent(ctx);
    const v2 = await createAgentVersion(ctx, agent.id, {
      instructions: "Novas instruções detalhadas.",
      allowedTools: ["content.copywriting"],
      changeNote: "Ajuste de foco",
    });
    expect(v2.version).toBe(2);
    const full = await getAgent(ctx, agent.id);
    expect(full.currentVersionId).toBe(v2.id);
    expect(full.versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("syncs presence with status changes", async () => {
    const ctx = await ctxFor("admin");
    const { agent } = await makeAgent(ctx);
    await setAgentStatus(ctx, agent.id, "paused");
    const [p] = await db().select().from(agentPresence).where(eq(agentPresence.agentId, agent.id));
    expect(p!.state).toBe("paused");
  });

  it("refuses agents in inactive departments", async () => {
    const ctx = await ctxFor("admin");
    const dept = await createDepartment(ctx, { name: "Inativo" });
    await setDepartmentActive(ctx, dept.id, false);
    await expect(
      createAgent(ctx, { departmentId: dept.id, name: "X1", title: "T1", specialty: "S1", instructions: "1234567890" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("audit log", () => {
  it("is append-only at the database level", async () => {
    const ctx = await ctxFor("admin");
    await createDepartment(ctx, { name: "Auditoria" });
    await expect(db().delete(auditLogs)).rejects.toThrow();
    await expect(db().update(auditLogs).set({ action: "tampered" })).rejects.toThrow();
  });
});
