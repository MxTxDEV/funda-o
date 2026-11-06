import { boolean, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./columns";
import { users } from "./users";

export const departments = pgTable(
  "departments",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Accent color (hex) used for the department zone in the office view. */
    color: text("color").notNull().default("#3d7bff"),
    isActive: boolean("is_active").notNull().default(true),
    /** Rows created by the demo seed. Never shown as real production data. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("departments_slug_uq").on(t.slug), index("departments_active_idx").on(t.isActive)],
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
