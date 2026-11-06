import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { updatedAt } from "./columns";
import { departments } from "./departments";
import { users } from "./users";

/**
 * Spatial configuration of the 3D office: which fixed room (zone) a department occupies.
 * Departments without a row are placed automatically (name matching), so existing data keeps working.
 */
export const departmentOfficeZones = pgTable(
  "department_office_zones",
  {
    departmentId: uuid("department_id")
      .primaryKey()
      .references(() => departments.id, { onDelete: "cascade" }),
    /** One of OFFICE_ZONE_KEYS (see @vc/core office.ts). */
    zone: text("zone").notNull(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("department_office_zones_zone_uq").on(t.zone)],
);

export type DepartmentOfficeZone = typeof departmentOfficeZones.$inferSelect;
