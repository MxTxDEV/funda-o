import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, tsz, updatedAt } from "./columns";
import { userRoleEnum } from "./enums";

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    /** Incremented on password change: sessions issued with an older value are rejected. */
    sessionVersion: integer("session_version").notNull().default(0),
    lockedUntil: tsz("locked_until"),
    lastLoginAt: tsz("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
