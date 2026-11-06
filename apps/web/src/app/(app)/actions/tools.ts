"use server";
import { setAgentAutonomy } from "@vc/core";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";

export async function setAgentAutonomyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const level = Number(form.get("autonomyLevel"));
  const res = await runAction((ctx) => setAgentAutonomy(ctx, id, level));
  if (!res.ok) return res;
  revalidatePath(`/agents/${id}`);
  revalidatePath("/tools");
  return { ok: true, message: `Nível de autonomia atualizado para ${level}.` };
}
