import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { tsz } from "./columns";

/** Fixed-window counters used for rate limiting when Redis is not configured. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: tsz("reset_at").notNull(),
});
