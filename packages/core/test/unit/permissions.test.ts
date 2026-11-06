import { describe, expect, it } from "vitest";
import { assertCan, can, type UserActor } from "../../src/auth/permissions";
import { AppError } from "../../src/errors";

const user = (role: UserActor["role"]): UserActor => ({ type: "user", userId: "u", email: "e", role });

describe("permissions", () => {
  it("owner can do everything", () => {
    expect(can(user("owner"), "users:manage")).toBe(true);
    expect(can(user("owner"), "approvals:decide")).toBe(true);
  });

  it("admin cannot manage users", () => {
    expect(can(user("admin"), "users:manage")).toBe(false);
    expect(can(user("admin"), "agents:write")).toBe(true);
  });

  it("operator manages tasks but cannot decide approvals or edit agents", () => {
    expect(can(user("operator"), "tasks:write")).toBe(true);
    expect(can(user("operator"), "approvals:decide")).toBe(false);
    expect(can(user("operator"), "agents:write")).toBe(false);
    expect(can(user("operator"), "audit:read")).toBe(false);
  });

  it("viewer is read-only", () => {
    expect(can(user("viewer"), "tasks:read")).toBe(true);
    expect(can(user("viewer"), "tasks:write")).toBe(false);
    expect(() => assertCan(user("viewer"), "departments:write")).toThrow(AppError);
  });
});
