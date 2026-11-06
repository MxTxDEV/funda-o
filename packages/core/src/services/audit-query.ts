import { auditLogs } from "@vc/db";
import { and, count, desc, eq, like } from "drizzle-orm";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { auditListSchema } from "../validation";

export async function listAuditLogs(ctx: ServiceContext, raw: Record<string, unknown> = {}) {
  assertCan(ctx.actor, "audit:read");
  const f = auditListSchema.parse(raw);
  const where = and(
    f.entityType ? eq(auditLogs.entityType, f.entityType) : undefined,
    f.entityId ? eq(auditLogs.entityId, f.entityId) : undefined,
    f.action ? like(auditLogs.action, `${f.action.replace(/[%_]/g, "")}%`) : undefined,
  );
  const [items, [total]] = await Promise.all([
    ctx.db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(f.limit).offset(f.offset),
    ctx.db.select({ value: count() }).from(auditLogs).where(where),
  ]);
  return { items, total: total?.value ?? 0, limit: f.limit, offset: f.offset };
}
