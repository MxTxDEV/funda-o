"use server";
import { decideApproval } from "@vc/core";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { formToObject } from "@/lib/utils";

export async function decideApprovalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, ...rest } = formToObject(form);
  const res = await runAction((ctx) => decideApproval(ctx, String(id), rest as never));
  if (!res.ok) return res;
  revalidatePath("/approvals");
  revalidatePath(`/approvals/${id}`);
  if (res.data.approval.taskId) revalidatePath(`/tasks/${res.data.approval.taskId}`);
  revalidatePath("/");
  return { ok: true, message: res.data.approval.status === "approved" ? "Aprovado." : "Rejeitado." };
}
