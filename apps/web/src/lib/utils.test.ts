import { describe, expect, it } from "vitest";
import { formToObject, formatRelative } from "./utils";

describe("formToObject", () => {
  it("keeps scalars, collects array keys and drops React action fields", () => {
    const f = new FormData();
    f.append("name", "Ana");
    f.append("allowedTools", "a");
    f.append("allowedTools", "b");
    f.append("$ACTION_ID_123", "x");
    expect(formToObject(f, ["allowedTools", "missing"])).toEqual({ name: "Ana", allowedTools: ["a", "b"], missing: [] });
  });
});

describe("formatRelative", () => {
  it("formats past times in Portuguese", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(formatRelative(new Date(now - 5 * 60_000), now)).toBe("há 5 minutos");
    expect(formatRelative(null)).toBe("—");
  });
});
