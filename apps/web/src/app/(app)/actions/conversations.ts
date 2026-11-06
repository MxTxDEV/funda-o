"use server";
import { archiveConversation, createConversation, postMessage } from "@vc/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { formToObject } from "@/lib/utils";

export async function createConversationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const res = await runAction((ctx) => createConversation(ctx, formToObject(form) as never));
  if (!res.ok) return res;
  revalidatePath("/conversations");
  redirect(`/conversations/${res.data.id}`);
}

export async function postMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("conversationId"));
  const res = await runAction((ctx) => postMessage(ctx, id, { content: String(form.get("content") ?? "") }));
  if (!res.ok) return res;
  revalidatePath(`/conversations/${id}`);
  return { ok: true };
}

export async function archiveConversationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("conversationId"));
  const res = await runAction((ctx) => archiveConversation(ctx, id));
  if (!res.ok) return res;
  revalidatePath("/conversations");
  redirect("/conversations");
}
