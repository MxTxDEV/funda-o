"use server";
import { getOrCreateDirectConversation, setDepartmentOfficeZone } from "@vc/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";

/** Explicit user action from the office: open (or create) the direct conversation with an employee. */
export async function openDirectConversationAction(form: FormData): Promise<void> {
  const res = await runAction((ctx) => getOrCreateDirectConversation(ctx, String(form.get("agentId"))));
  if (!res.ok) redirect(`/conversations?error=${encodeURIComponent(res.message)}`);
  revalidatePath("/conversations");
  redirect(`/conversations/${res.data.conversation.id}`);
}

/** Moves a department to another room of the office (audited, requires departments:write). */
export async function setDepartmentZoneAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const zone = String(form.get("zone") ?? "");
  const res = await runAction((ctx) => setDepartmentOfficeZone(ctx, String(form.get("departmentId")), zone === "" ? null : zone));
  if (!res.ok) return res;
  revalidatePath("/office");
  return { ok: true, message: res.data.swappedWith ? "Sala atualizada (departamentos trocaram de sala)." : "Sala atualizada." };
}
