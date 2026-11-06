import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../src/auth/password";
import { validatePasswordStrength } from "../../src/services/users";

describe("password hashing", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("Sup3r-Secret!");
    const b = await hashPassword("Sup3r-Secret!");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Sup3r-Secret!", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
  });

  it("rejects malformed hashes and the dummy hash", async () => {
    expect(await verifyPassword("x", "plain")).toBe(false);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });

  it("enforces password strength", () => {
    expect(validatePasswordStrength("short")).not.toBeNull();
    expect(validatePasswordStrength("alllowercaseletters")).not.toBeNull();
    expect(validatePasswordStrength("Strong-Passw0rd")).toBeNull();
  });
});
