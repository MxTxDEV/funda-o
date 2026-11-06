import { approvals, type Task } from "@vc/db";
import { auditLogs } from "@vc/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { conflict, notFound } from "../errors";
import { approvalDecisionSchema, type ApprovalDecisionInput, approvalListSchema, idSchema } from "../validation";
import { applyTransition, enqueueAfterCommit, lockTask, recordTaskEvent } from "./tasks";

export async function listApprovals(ctx: ServiceContext, raw: { status?: string; limit?: number; offset?: number } = {}) {
  assertCan(ctx.actor, "approvals:read");
  const f = approvalListSchema.parse(raw);
  const where = f.status ? eq(approvals.status, f.status) : undefined;
  const [items, [total]] = await Promise.all([
    ctx.db.query.approvals.findMany({
      where,
      with: {
        task: { columns: { id: true, title: true, status: true, isDemo: true } },
        agent: { columns: { id: true, name: true, avatarSeed: true, avatarUrl: true } },
      },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit: f.limit,
      offset: f.offset,
    }),
    ctx.db.select({ value: count() }).from(approvals).where(where),
  ]);
  return { items, total: total?.value ?? 0, limit: f.limit, offset: f.offset };
}

export async function getApproval(ctx: ServiceContext, id: string) {
  assertCan(ctx.actor, "approvals:read");
  const approvalId = idSchema.parse(id);
  const approval = await ctx.db.query.approvals.findFirst({
    where: eq(approvals.id, approvalId),
    with: {
      task: true,
      agent: { columns: { id: true, name: true, title: true, avatarSeed: true, avatarUrl: true } },
    },
  });
  if (!approval) throw notFound("Aprovação");
  const history = await ctx.db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, "approval"), eq(auditLogs.entityId, approvalId)))
    .orderBy(desc(auditLogs.createdAt));
  return { ...approval, history };
}

/**
 * Approves or rejects a pending approval. Concurrency control:
 * the UPDATE only matches when the approval is still pending AND has the version the user saw,
 * so two simultaneous decisions can never both succeed.
 */
export async function decideApproval(ctx: ServiceContext, id: string, raw: ApprovalDecisionInput) {
  assertCan(ctx.actor, "approvals:decide");
  if (ctx.actor.type !== "user") throw new Error("decisions require a user actor");
  const actor = ctx.actor;
  const approvalId = idSchema.parse(id);
  const input = approvalDecisionSchema.parse(raw);
  const status = input.decision === "approve" ? "approved" : "rejected";

  const { approval, requeued } = await ctx.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(approvals)
      .set({
        status,
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
        decisionNote: input.note || null,
        version: sql`${approvals.version} + 1`,
      })
      .where(and(eq(approvals.id, approvalId), eq(approvals.status, "pending"), eq(approvals.version, input.expectedVersion)))
      .returning();

    if (!updated) {
      const [current] = await tx.select().from(approvals).where(eq(approvals.id, approvalId));
      if (!current) throw notFound("Aprovação");
      if (current.status !== "pending") {
        throw conflict("Esta aprovação já foi decidida por outra pessoa ou processo.", { status: current.status });
      }
      throw conflict("A aprovação foi modificada. Recarregue a página e tente novamente.", { version: current.version });
    }

    await writeAudit(
      tx,
      ctx.actor,
      {
        action: input.decision === "approve" ? "approval.approve" : "approval.reject",
        entityType: "approval",
        entityId: approvalId,
        changes: { status: { from: "pending", to: status }, note: input.note },
      },
      ctx.meta,
    );

    let requeued: Task | null = null;
    if (updated.taskId) {
      const task = await lockTask(tx, updated.taskId);
      if (task.status === "waiting_approval") {
        if (input.decision === "approve") {
          // Continue execution in a new run; the processor sees the granted approval.
          requeued = await applyTransition(
            tx,
            ctx.actor,
            task,
            "queued",
            { type: "approval_granted", message: input.note || "Aprovado", data: { approvalId } },
            { runCount: task.runCount + 1, queuedAt: new Date() },
          );
        } else {
          await applyTransition(
            tx,
            ctx.actor,
            task,
            "failed",
            { type: "approval_rejected", message: input.note || "Rejeitado", data: { approvalId } },
            {
              error: { code: "APPROVAL_REJECTED", message: input.note || "Aprovação rejeitada" },
              finishedAt: new Date(),
            },
          );
        }
      } else {
        await recordTaskEvent(tx, ctx.actor, task.id, {
          type: input.decision === "approve" ? "approval_granted" : "approval_rejected",
          message: "Decisão registrada, mas a tarefa não aguardava mais aprovação",
          data: { approvalId, taskStatus: task.status },
        });
      }
    }
    return { approval: updated, requeued };
  });

  const enqueued = requeued ? await enqueueAfterCommit(requeued) : false;
  return { approval, task: requeued, enqueued };
}
