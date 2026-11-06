import { auditLogs, users } from "@vc/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { authenticateUser, changeOwnPassword, getActiveUser, upsertUser, type UserActor } from "../../src";
import { db, resetState } from "../helpers";

beforeEach(resetState);

async function owner() {
  const { user } = await upsertUser(db(), { email: "dono@empresa.com", name: "Dono", password: "Senha-Antiga-123", role: "owner" });
  const actor: UserActor = { type: "user", userId: user.id, email: user.email, role: "owner" };
  return { user, actor };
}

describe("change own password", () => {
  it("changes the password, invalidates older sessions and audits", async () => {
    const { user, actor } = await owner();
    expect((await getActiveUser(db(), user.id))!.sessionVersion).toBe(0);
    await changeOwnPassword(db(), actor, { currentPassword: "Senha-Antiga-123", newPassword: "Nova-Senha-Forte-9", confirmPassword: "Nova-Senha-Forte-9" });
    expect((await authenticateUser(db(), "dono@empresa.com", "Senha-Antiga-123")).ok).toBe(false);
    const ok = await authenticateUser(db(), "dono@empresa.com", "Nova-Senha-Forte-9");
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.user.sessionVersion).toBe(1);
    expect((await getActiveUser(db(), user.id))!.sessionVersion).toBe(1);
    const logs = await db().select().from(auditLogs).where(eq(auditLogs.action, "auth.password_change"));
    expect(logs).toHaveLength(1);
    // the audit never stores the password
    expect(JSON.stringify(logs)).not.toContain("Nova-Senha");
  });

  it("rejects a wrong current password, weak or mismatched new passwords and reuse", async () => {
    const { actor } = await owner();
    await expect(
      changeOwnPassword(db(), actor, { currentPassword: "errada", newPassword: "Nova-Senha-Forte-9", confirmPassword: "Nova-Senha-Forte-9" }),
    ).rejects.toMatchObject({ code: "VALIDATION", message: "Senha atual incorreta." });
    await expect(changeOwnPassword(db(), actor, { currentPassword: "Senha-Antiga-123", newPassword: "fraca", confirmPassword: "fraca" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      changeOwnPassword(db(), actor, { currentPassword: "Senha-Antiga-123", newPassword: "Nova-Senha-Forte-9", confirmPassword: "Outra-Senha-Forte-9" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      changeOwnPassword(db(), actor, { currentPassword: "Senha-Antiga-123", newPassword: "Senha-Antiga-123", confirmPassword: "Senha-Antiga-123" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const [u] = await db().select().from(users);
    expect(u!.sessionVersion).toBe(0);
    const failed = await db().select().from(auditLogs).where(eq(auditLogs.action, "auth.password_change_failed"));
    expect(failed).toHaveLength(1);
  });
});
