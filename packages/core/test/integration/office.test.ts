import { auditLogs } from "@vc/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  beginTaskRun,
  createAgent,
  createDepartment,
  createTask,
  getOfficeSnapshot,
  getOrCreateDirectConversation,
  setAgentStatus,
  setDepartmentOfficeZone,
} from "../../src";
import { ctxFor, db, makeAgent, resetState } from "../helpers";

beforeEach(resetState);

describe("office snapshot", () => {
  it("is empty on an empty database", async () => {
    const s = await getOfficeSnapshot(await ctxFor("viewer"));
    expect(s.agents).toEqual([]);
    expect(s.departments).toEqual([]);
    expect(s.metrics).toMatchObject({ agents: 0, working: 0, available: 0, activeTasks: 0, pendingApprovals: 0, departments: 0 });
    expect(s.brain.integrated).toBe(false);
    expect(s.permissions.manageDepartments).toBe(false);
  });

  it("reflects real agents, desks, statuses and metrics", async () => {
    const ctx = await ctxFor("admin");
    const dept = await createDepartment(ctx, { name: "Criação & Copy" });
    const mk = (name: string) =>
      createAgent(ctx, { departmentId: dept.id, name, title: "Copywriter", specialty: "Copy", instructions: "Escreva bem e claro." });
    const a1 = await mk("Ana");
    const a2 = await mk("Bia");
    const a3 = await mk("Caio");
    await setAgentStatus(ctx, a3.id, "paused");
    const { task } = await createTask(ctx, { title: "Headline", type: "demo.lifecycle", assignedAgentId: a1.id, dispatch: true });
    await beginTaskRun(db(), { taskId: task.id, runNumber: 1 });
    await createTask(ctx, { title: "Roteiro", type: "demo.lifecycle", assignedAgentId: a2.id, dispatch: true });

    const s = await getOfficeSnapshot(ctx);
    const byName = Object.fromEntries(s.agents.map((a) => [a.name, a]));
    expect(byName.Ana!.officeStatus).toBe("executing");
    expect(byName.Ana!.currentTask?.title).toBe("Headline");
    expect(byName.Ana!.recentEvents.length).toBeGreaterThan(0);
    expect(byName.Bia!.officeStatus).toBe("working");
    expect(byName.Caio!.officeStatus).toBe("resting");
    expect(s.agents.map((a) => a.deskIndex)).toEqual([0, 1, 2]);
    expect(s.departments[0]).toMatchObject({ zone: "offers", zoneSource: "auto", agentCount: 3, activeTaskCount: 2, availableCount: 0 });
    expect(s.metrics).toMatchObject({ agents: 3, working: 1, queued: 1, resting: 1, activeTasks: 2, departments: 1 });
  });

  it("assigns and swaps rooms with audit, respecting permissions", async () => {
    const ctx = await ctxFor("admin");
    const a = await createDepartment(ctx, { name: "Copy" });
    const b = await createDepartment(ctx, { name: "Tráfego" });
    await setDepartmentOfficeZone(ctx, a.id, "traffic");
    let s = await getOfficeSnapshot(ctx);
    const zoneOf = (id: string) => s.departments.find((d) => d.id === id)?.zone;
    expect(zoneOf(a.id)).toBe("traffic");
    expect(zoneOf(b.id)).not.toBe("traffic");
    await setDepartmentOfficeZone(ctx, b.id, "traffic"); // swap: a gets b's previous (none) → auto
    s = await getOfficeSnapshot(ctx);
    expect(zoneOf(b.id)).toBe("traffic");
    expect(zoneOf(a.id)).toBe("offers");
    const logs = await db().select().from(auditLogs).where(eq(auditLogs.action, "department.office_zone"));
    expect(logs).toHaveLength(2);
    const op = await ctxFor("operator");
    await expect(setDepartmentOfficeZone(op, a.id, "design")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setDepartmentOfficeZone(ctx, a.id, "moon")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("opens the same direct conversation instead of duplicating", async () => {
    const ctx = await ctxFor("admin");
    const { agent } = await makeAgent(ctx);
    const first = await getOrCreateDirectConversation(ctx, agent.id);
    const second = await getOrCreateDirectConversation(ctx, agent.id);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
    const s = await getOfficeSnapshot(ctx);
    expect(s.agents[0]!.directConversationId).toBe(first.conversation.id);
    const viewer = await ctxFor("viewer");
    await expect(getOrCreateDirectConversation(viewer, agent.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
