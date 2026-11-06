import { type Database, users } from "@vc/db";
import { eq, sql } from "drizzle-orm";
import { writeAudit, type RequestMeta } from "../audit";
import { DUMMY_HASH, hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "../auth/password";
import { SYSTEM_ACTOR, type UserActor } from "../auth/permissions";
import { AppError } from "../errors";
import type { UserRole } from "@vc/db/values";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AuthResult = { ok: true; user: UserActor & { name: string; sessionVersion: number } } | { ok: false; reason: "invalid" | "locked" };

/**
 * Verifies credentials. Always runs a password hash (even for unknown emails) to avoid
 * user enumeration through timing. Locks the account after repeated failures.
 */
export async function authenticateUser(db: Database, email: string, password: string, meta?: RequestMeta): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`);

  if (!user || !user.isActive) {
    await verifyPassword(password, DUMMY_HASH);
    await writeAudit(db, SYSTEM_ACTOR, { action: "auth.login_failed", entityType: "user", metadata: { email: normalized } }, meta);
    return { ok: false, reason: "invalid" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(password, DUMMY_HASH);
    await writeAudit(db, SYSTEM_ACTOR, { action: "auth.login_locked", entityType: "user", entityId: user.id }, meta);
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await db
      .update(users)
      .set({
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    await writeAudit(
      db,
      SYSTEM_ACTOR,
      { action: lock ? "auth.account_locked" : "auth.login_failed", entityType: "user", entityId: user.id, metadata: { attempts } },
      meta,
    );
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }

  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const actor: UserActor = { type: "user", userId: user.id, email: user.email, role: user.role };
  await writeAudit(db, actor, { action: "auth.login", entityType: "user", entityId: user.id }, meta);
  return { ok: true, user: { ...actor, name: user.name, sessionVersion: user.sessionVersion } };
}

/** Loads the current state of a session user. Authorization always uses the DB role, never a stale token. */
export async function getActiveUser(db: Database, userId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive, sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId));
  if (!user || !user.isActive) return null;
  return user;
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3) return "Use pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.";
  return null;
}

/** Creates the user or resets its password/role. Used by the bootstrap CLI. */
export async function upsertUser(db: Database, input: { email: string; name: string; password: string; role: UserRole }) {
  const problem = validatePasswordStrength(input.password);
  if (problem) throw new Error(problem);
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (existing) {
      const [updated] = await tx
        .update(users)
        .set({ name: input.name, passwordHash, role: input.role, isActive: true, failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, existing.id))
        .returning();
      await writeAudit(tx, SYSTEM_ACTOR, { action: "user.reset", entityType: "user", entityId: existing.id, changes: { role: input.role } });
      return { user: updated!, created: false };
    }
    const [created] = await tx.insert(users).values({ email, name: input.name, passwordHash, role: input.role }).returning();
    await writeAudit(tx, SYSTEM_ACTOR, { action: "user.create", entityType: "user", entityId: created!.id, changes: { email, role: input.role } });
    return { user: created!, created: true };
  });
}

/**
 * Changes the password of the signed-in user. Requires the current password, enforces the
 * strength policy and increments the session version so every other session is signed out.
 */
export async function changeOwnPassword(
  db: Database,
  actor: UserActor,
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
  meta?: RequestMeta,
) {
  if (input.newPassword !== input.confirmPassword) {
    throw new AppError("VALIDATION", "A confirmação não confere com a nova senha.", { fieldErrors: { confirmPassword: ["As senhas não conferem."] } });
  }
  const problem = validatePasswordStrength(input.newPassword);
  if (problem) throw new AppError("VALIDATION", problem, { fieldErrors: { newPassword: [problem] } });

  const [user] = await db.select().from(users).where(eq(users.id, actor.userId));
  if (!user || !user.isActive) throw new AppError("UNAUTHORIZED", "Sessão inválida.");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    await writeAudit(db, actor, { action: "auth.password_change_failed", entityType: "user", entityId: user.id }, meta);
    throw new AppError("VALIDATION", "Senha atual incorreta.", { fieldErrors: { currentPassword: ["Senha atual incorreta."] } });
  }
  if (await verifyPassword(input.newPassword, user.passwordHash)) {
    throw new AppError("VALIDATION", "A nova senha deve ser diferente da atual.", { fieldErrors: { newPassword: ["Use uma senha diferente da atual."] } });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
    await writeAudit(tx, actor, { action: "auth.password_change", entityType: "user", entityId: user.id }, meta);
  });
}
