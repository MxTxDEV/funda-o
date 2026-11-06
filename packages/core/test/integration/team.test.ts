import { agents, auditLogs, departments } from "@vc/db";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createAgent,
  createDepartment,
  getAgent,
  getOfficeSnapshot,
  initialTeamStatus,
  seedInitialTeam,
  setDepartmentActive,
  updateAgent,
} from "../../src";
import { ctxFor, db, resetState } from "../helpers";

beforeEach(resetState);

describe("initial team seed", () => {
  it("registers 11 real employees with hierarchy, reusing existing departments", async () => {
    const ctx = await ctxFor("owner");
    const existing = await createDepartment(ctx, { name: "Estratégia & Pesquisa", color: "#123456" });
    const r = await seedInitialTeam(ctx);
    expect(r.createdAgents).toHaveLength(11);
    expect(r.reusedDepartments).toContain("Estratégia & Pesquisa");
    expect(r.createdDepartments.sort()).toEqual(["Design & Criativos", "Diretoria", "Funis & Desenvolvimento", "Ofertas & Copywriting", "Tráfego & Performance"].sort());

    const rows = await db().select().from(agents);
    expect(rows).toHaveLength(11);
    const by = Object.fromEntries(rows.map((a) => [a.name, a]));
    expect(by.Alex!.hierarchyLevel).toBe("coo");
    expect(by.Alex!.reportsToAgentId).toBeNull();
    expect(by.Sophia!.reportsToAgentId).toBe(by.Alex!.id);
    expect(by.Sophia!.departmentId).toBe(existing.id);
    expect(by.Lucas!.reportsToAgentId).toBe(by.Sophia!.id);
    expect(by.Beatriz!.responsibilities).toContain("Analisar ROAS");

    const alex = await getAgent(ctx, by.Alex!.id);
    expect(alex.directReports.map((d) => d.name).sort()).toEqual(["Daniel", "Henrique", "Isabella", "Marina", "Sophia"]);
    expect(alex.currentVersion?.instructions).toContain("NÃO pode gastar dinheiro");
    expect(alex.currentVersion?.aiProvider).toBeNull();

    expect(await initialTeamStatus(ctx)).toEqual({ registered: 11, total: 11 });
    const audits = await db().select().from(auditLogs).where(eq(auditLogs.action, "agent.create"));
    expect(audits).toHaveLength(11);
  });

  it("is idempotent and never overwrites customizations", async () => {
    const ctx = await ctxFor("owner");
    await seedInitialTeam(ctx);
    const [sophia] = await db().select().from(agents).where(eq(agents.name, "Sophia"));
    await updateAgent(ctx, sophia!.id, { title: "Head de Inteligência", personality: "Personalizada" });
    const again = await seedInitialTeam(ctx);
    expect(again.createdAgents).toEqual([]);
    expect(again.createdDepartments).toEqual([]);
    expect(again.skippedAgents).toHaveLength(11);
    expect(await db().select().from(agents)).toHaveLength(11);
    expect(await db().select().from(departments)).toHaveLength(6);
    const [after] = await db().select().from(agents).where(eq(agents.id, sophia!.id));
    expect(after).toMatchObject({ title: "Head de Inteligência", personality: "Personalizada" });
  });

  it("adopts an employee already registered with the same name instead of duplicating", async () => {
    const ctx = await ctxFor("owner");
    const dept = await createDepartment(ctx, { name: "Diretoria" });
    const mine = await createAgent(ctx, { departmentId: dept.id, name: "alex", title: "Meu COO", specialty: "Ops", instructions: "Minhas instruções." });
    const r = await seedInitialTeam(ctx);
    expect(r.adoptedAgents).toEqual(["Alex"]);
    const alexes = await db().select().from(agents).where(sql`lower(${agents.name}) = 'alex'`);
    expect(alexes).toHaveLength(1);
    expect(alexes[0]).toMatchObject({ id: mine.id, title: "Meu COO", seedKey: "team:alex" });
    // The adopted "alex" keeps its own (specialist) level, so directors are registered without a manager + warning.
    const [sophia] = await db().select().from(agents).where(eq(agents.name, "Sophia"));
    expect(sophia!.reportsToAgentId).toBeNull();
    expect(r.warnings.join(" ")).toMatch(/nível incompatível/);
  });

  it("does not register employees of inactive departments", async () => {
    const ctx = await ctxFor("owner");
    const d = await createDepartment(ctx, { name: "Tráfego & Performance" });
    await setDepartmentActive(ctx, d.id, false);
    const r = await seedInitialTeam(ctx);
    expect(r.createdAgents).not.toContain("Henrique");
    expect(r.warnings.join(" ")).toMatch(/inativo/);
  });

  it("requires admin permissions", async () => {
    const op = await ctxFor("operator");
    await expect(seedInitialTeam(op)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("places the team in the office: Alex in the Diretoria, nobody shown as working without a task", async () => {
    const ctx = await ctxFor("owner");
    await seedInitialTeam(ctx);
    const s = await getOfficeSnapshot(ctx);
    const diretoria = s.departments.find((d) => d.name === "Diretoria")!;
    expect(diretoria.zone).toBe("executive");
    expect(new Set(s.departments.map((d) => d.zone)).size).toBe(6);
    expect(s.metrics.working).toBe(0);
    expect(s.agents.every((a) => a.officeStatus === "available" && a.aiConnection === "not_configured")).toBe(true);
  });
});

describe("hierarchy rules", () => {
  it("rejects invalid reporting lines and cycles", async () => {
    const ctx = await ctxFor("owner");
    await seedInitialTeam(ctx);
    const rows = await db().select().from(agents);
    const by = Object.fromEntries(rows.map((a) => [a.name, a]));
    // a specialist cannot manage a director
    await expect(updateAgent(ctx, by.Sophia!.id, { reportsToAgentId: by.Lucas!.id })).rejects.toMatchObject({ code: "INVALID_STATE" });
    // self reference
    await expect(updateAgent(ctx, by.Lucas!.id, { reportsToAgentId: by.Lucas!.id })).rejects.toMatchObject({ code: "INVALID_STATE" });
    // demoting a director with reports is blocked
    await expect(updateAgent(ctx, by.Sophia!.id, { hierarchyLevel: "specialist" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    // valid move
    await updateAgent(ctx, by.Lucas!.id, { reportsToAgentId: by.Isabella!.id });
  });
});
