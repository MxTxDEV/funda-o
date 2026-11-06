import { agents, conversations, departments, messages } from "@vc/db";
import { and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "../audit";
import { assertCan } from "../auth/permissions";
import type { ServiceContext } from "../context";
import { invalidState, notFound } from "../errors";
import { type ConversationCreateInput, conversationCreateSchema, idSchema, messageCreateSchema } from "../validation";

/**
 * Conversation infrastructure (direct / department / general).
 * FOUNDATION stores human messages only: agents do NOT answer until the Central Brain is integrated.
 */
export async function listConversations(ctx: ServiceContext, opts: { includeArchived?: boolean } = {}) {
  assertCan(ctx.actor, "conversations:read");
  return ctx.db.query.conversations.findMany({
    where: opts.includeArchived ? undefined : isNull(conversations.archivedAt),
    with: {
      agent: { columns: { id: true, name: true, avatarSeed: true, avatarUrl: true } },
      department: { columns: { id: true, name: true, color: true } },
    },
    orderBy: (c, { desc, sql }) => [desc(sql`coalesce(${c.lastMessageAt}, ${c.createdAt})`)],
  });
}

export async function getConversation(ctx: ServiceContext, id: string, opts: { limit?: number } = {}) {
  assertCan(ctx.actor, "conversations:read");
  const conversationId = idSchema.parse(id);
  const conversation = await ctx.db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      agent: { columns: { id: true, name: true, title: true, avatarSeed: true, avatarUrl: true } },
      department: { columns: { id: true, name: true, color: true } },
    },
  });
  if (!conversation) throw notFound("Conversa");
  const recent = await ctx.db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit: Math.min(opts.limit ?? 200, 500),
  });
  return { ...conversation, messages: recent.reverse() };
}

export async function createConversation(ctx: ServiceContext, raw: ConversationCreateInput) {
  assertCan(ctx.actor, "conversations:write");
  const input = conversationCreateSchema.parse(raw);
  return ctx.db.transaction(async (tx) => {
    let title = input.title;
    if (input.kind === "direct") {
      const [agent] = await tx.select().from(agents).where(eq(agents.id, input.agentId!));
      if (!agent) throw notFound("Funcionário");
      if (agent.status === "archived") throw invalidState("Funcionário arquivado.");
      title ??= `Conversa com ${agent.name}`;
    } else if (input.kind === "department") {
      const [dept] = await tx.select().from(departments).where(eq(departments.id, input.departmentId!));
      if (!dept) throw notFound("Departamento");
      title ??= `Departamento: ${dept.name}`;
    } else {
      title ??= "Canal geral";
    }
    const [created] = await tx
      .insert(conversations)
      .values({
        kind: input.kind,
        title,
        agentId: input.agentId ?? null,
        departmentId: input.departmentId ?? null,
        createdById: ctx.actor.type === "user" ? ctx.actor.userId : null,
      })
      .returning();
    await writeAudit(
      tx,
      ctx.actor,
      { action: "conversation.create", entityType: "conversation", entityId: created!.id, changes: { kind: input.kind, title } },
      ctx.meta,
    );
    return created!;
  });
}

export async function postMessage(ctx: ServiceContext, conversationId: string, raw: { content: string }) {
  assertCan(ctx.actor, "conversations:write");
  if (ctx.actor.type !== "user") throw new Error("only users post messages in this phase");
  const userId = ctx.actor.userId;
  const id = idSchema.parse(conversationId);
  const input = messageCreateSchema.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, id)).for("update");
    if (!conversation) throw notFound("Conversa");
    if (conversation.archivedAt) throw invalidState("Conversa arquivada.");
    const [message] = await tx
      .insert(messages)
      .values({ conversationId: id, authorType: "user", authorUserId: userId, content: input.content })
      .returning();
    await tx.update(conversations).set({ lastMessageAt: message!.createdAt }).where(eq(conversations.id, id));
    await writeAudit(
      tx,
      ctx.actor,
      { action: "message.create", entityType: "conversation", entityId: id, metadata: { messageId: message!.id } },
      ctx.meta,
    );
    return message!;
  });
}

export async function archiveConversation(ctx: ServiceContext, conversationId: string) {
  assertCan(ctx.actor, "conversations:write");
  const id = idSchema.parse(conversationId);
  return ctx.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(conversations)
      .set({ archivedAt: new Date() })
      .where(and(eq(conversations.id, id), isNull(conversations.archivedAt)))
      .returning();
    if (!updated) throw notFound("Conversa");
    await writeAudit(tx, ctx.actor, { action: "conversation.archive", entityType: "conversation", entityId: id }, ctx.meta);
    return updated;
  });
}

/** Returns the open direct conversation with an agent, creating it if needed (explicit user action). */
export async function getOrCreateDirectConversation(ctx: ServiceContext, agentId: string) {
  assertCan(ctx.actor, "conversations:write");
  const id = idSchema.parse(agentId);
  const [existing] = await ctx.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.kind, "direct"), eq(conversations.agentId, id), isNull(conversations.archivedAt)))
    .orderBy(conversations.createdAt)
    .limit(1);
  if (existing) return { conversation: existing, created: false };
  return { conversation: await createConversation(ctx, { kind: "direct", agentId: id }), created: true };
}
