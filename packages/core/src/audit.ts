import { auditLogs, type DbExecutor } from "@vc/db";
import { type Actor, actorLabel, actorUserId } from "./auth/permissions";

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/** Writes an audit record. Call it inside the same transaction as the mutation it describes. */
export async function writeAudit(db: DbExecutor, actor: Actor, entry: AuditEntry, meta?: RequestMeta) {
  await db.insert(auditLogs).values({
    actorType: actor.type,
    actorUserId: actorUserId(actor),
    actorLabel: actorLabel(actor),
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    changes: entry.changes ?? {},
    metadata: entry.metadata ?? {},
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent?.slice(0, 300) ?? null,
  });
}

/** Builds a {field: {from, to}} diff for the given keys. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (b !== undefined && JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a ?? null, to: b };
  }
  return out;
}
