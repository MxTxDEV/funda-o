import { describe, expect, it } from "vitest";
import { demoLifecycleInputSchema } from "../../src/task-types";
import { TOOL_CATALOG } from "../../src/tools";
import { agentCreateSchema, conversationCreateSchema, taskCreateSchema } from "../../src/validation";

const uuid = "4f0f8d2e-8a4c-4c1e-9a55-0d2b6f7d9c11";

describe("tool catalog", () => {
  it("never allows spending or publishing in the FOUNDATION phase", () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.allowsSpend).toBe(false);
      expect(tool.readOnly).toBe(true);
      expect(tool.id).not.toMatch(/publish|spend|budget/);
    }
  });
});

describe("validation", () => {
  it("rejects unknown tools on agents", () => {
    const r = agentCreateSchema.safeParse({
      departmentId: uuid,
      name: "Ana",
      title: "Copy",
      specialty: "Copy",
      instructions: "Escreva bons textos.",
      allowedTools: ["meta_ads.publish"],
    });
    expect(r.success).toBe(false);
  });

  it("deduplicates tools and accepts empty avatar", () => {
    const r = agentCreateSchema.parse({
      departmentId: uuid,
      name: "Ana",
      title: "Copy",
      specialty: "Copy",
      instructions: "Escreva bons textos.",
      allowedTools: ["content.copywriting", "content.copywriting"],
      avatarUrl: "",
    });
    expect(r.allowedTools).toEqual(["content.copywriting"]);
    expect(r.avatarUrl).toBeUndefined();
  });

  it("requires https avatars", () => {
    const r = agentCreateSchema.safeParse({
      departmentId: uuid,
      name: "Ana",
      title: "Copy",
      specialty: "Copy",
      instructions: "Escreva bons textos.",
      avatarUrl: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });

  it("parses form-style task input", () => {
    const r = taskCreateSchema.parse({ title: "Pesquisa", type: "demo.lifecycle", assignedAgentId: "", dispatch: "on" });
    expect(r.assignedAgentId).toBeUndefined();
    expect(r.dispatch).toBe(true);
    expect(taskCreateSchema.parse({ title: "Pesquisa", type: "demo.lifecycle" }).dispatch).toBe(false);
  });

  it("rejects unknown task types", () => {
    expect(taskCreateSchema.safeParse({ title: "x".repeat(5), type: "ads.publish" }).success).toBe(false);
  });

  it("validates demo input bounds", () => {
    expect(demoLifecycleInputSchema.parse({})).toEqual({ steps: 3, requireApproval: false, failTimes: 0 });
    expect(demoLifecycleInputSchema.safeParse({ steps: 50 }).success).toBe(false);
  });

  it("requires a target for direct and department conversations", () => {
    expect(conversationCreateSchema.safeParse({ kind: "direct" }).success).toBe(false);
    expect(conversationCreateSchema.safeParse({ kind: "department", departmentId: uuid }).success).toBe(true);
    const g = conversationCreateSchema.parse({ kind: "general", agentId: uuid });
    expect(g.agentId).toBeUndefined();
  });
});
