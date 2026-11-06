"use server";
import { testProviderConnection } from "@vc/core";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";

export async function testProviderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const provider = String(form.get("provider") ?? "");
  const res = await runAction((ctx) => testProviderConnection(ctx, provider));
  if (!res.ok) return res;
  revalidatePath("/ai");
  return res.data.ok ? { ok: true, message: `Conexão verificada: ${res.data.message}` } : { ok: false, message: res.data.message };
}
