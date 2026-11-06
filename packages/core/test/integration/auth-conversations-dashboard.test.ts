import { users } from "@vc/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateUser,
  createConversation,
  createTask,
  getConversation,
  getDashboard,
  listAuditLogs,
  postMessage,
  rateLimit,
  upsertUser,
} from "../../src";
import { purgeDemo, seedDemo } from "../../src/seed/demo-data";
import { ctxFor, db, makeAgent, resetState } from "../helpers";

beforeEach(resetState);

describe("authentication", () => {
  it("authenticates valid credentials case-insensitively", async () => {
    await upsertUser(db(), { email: "Dono@Empresa.com", name: "Dono", password: "Muito-Segura-123", role: "owner" });
    const r = await authenticateUser(db(), "dono@empresa.com", "Muito-Segura-123");
    expect(r.ok).toBe(true);
  });

  it("locks the account after 5 failures", async () => {
    await upsertUser(db(), { email: "a@b.com", name: "A", password: "Muito-Segura-123", role: "owner" });
    for (let i = 0; i < 5; i++) await authenticateUser(db(), "a@b.com", "errada");
    const r = await authenticateUser(db(), "a@b.com", "Muito-Segura-123");
    expect(r).toEqual({ ok: false, reason: "locked" });
  });

  it("does not authenticate inactive or unknown users", async () => {
    const { user } = await upsertUser(db(), { email: "x@y.com", name: "X", password: "Muito-Segura-123", role: "viewer" });
    await db().update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect((await authenticateUser(db(), "x@y.com", "Muito-Segura-123")).ok).toBe(false);
    expect((await authenticateUser(db(), "ghost@y.com", "Muito-Segura-123")).ok).toBe(false);
  });

  it("rejects weak bootstrap passwords", async () => {
    await expect(upsertUser(db(), { email: "w@y.com", name: "W", password: "fraca", role: "owner" })).rejects.toThrow();
  });
});

describe("rate limiting", () => {
  it("blocks after the limit", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60)).allowed).toBe(true);
    expect((await rateLimit(key, 3, 60)).allowed).toBe(false);
  });
});

describe("conversations", () => {
  it("stores user messages without generating agent replies", async () => {
    const ctx = await ctxFor("operator");
    const admin = await ctxFor("admin");
    const { agent } = await makeAgent(admin);
    const conv = await createConversation(ctx, { kind: "direct", agentId: agent.id });
    expect(conv.title).toContain("Agente Teste");
    await postMessage(ctx, conv.id, { content: "Olá, equipe!" });
    const full = await getConversation(ctx, conv.id);
    expect(full.messages).toHaveLength(1);
    expect(full.messages[0]!.authorType).toBe("user");
  });

  it("supports general and department channels", async () => {
    const ctx = await ctxFor("admin");
    const { dept } = await makeAgent(ctx);
    expect((await createConversation(ctx, { kind: "general" })).title).toBe("Canal geral");
    expect((await createConversation(ctx, { kind: "department", departmentId: dept.id })).departmentId).toBe(dept.id);
  });
});

describe("dashboard", () => {
  it("returns real zeros on an empty database", async () => {
    const ctx = await ctxFor("viewer");
    const d = await getDashboard(ctx);
    expect(d.tasks.total).toBe(0);
    expect(d.agents.total).toBe(0);
    expect(d.floor).toEqual([]);
    expect(d.hasDemoData).toBe(false);
    expect(d.queue).not.toBeNull();
  });

  it("reflects created data", async () => {
    const ctx = await ctxFor("admin");
    const { agent } = await makeAgent(ctx);
    await createTask(ctx, { title: "Uma tarefa", type: "demo.lifecycle", assignedAgentId: agent.id, dispatch: true });
    const d = await getDashboard(ctx);
    expect(d.tasks.byStatus.queued).toBe(1);
    expect(d.agents.total).toBe(1);
    expect(d.presence.idle).toBe(1);
    expect(d.recentEvents.length).toBeGreaterThan(0);
  });

  it("restricts audit reading to privileged roles", async () => {
    const viewer = await ctxFor("viewer");
    await expect(listAuditLogs(viewer)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await ctxFor("admin");
    expect((await listAuditLogs(admin)).items).toBeInstanceOf(Array);
  });
});

describe("demo seed", () => {
  it("creates clearly flagged demo data and purges it", async () => {
    const r = await seedDemo(db());
    expect(r.skipped).toBe(false);
    expect((await seedDemo(db())).skipped).toBe(true);
    const ctx = await ctxFor("viewer");
    const d = await getDashboard(ctx);
    expect(d.hasDemoData).toBe(true);
    expect(d.floor.every((a) => a.isDemo)).toBe(true);
    const summary = await purgeDemo(db());
    expect(summary.agents).toBe(4);
    expect((await getDashboard(ctx)).hasDemoData).toBe(false);
  });
});
