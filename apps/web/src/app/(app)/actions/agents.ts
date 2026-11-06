"use server";
import { activateAgentVersion, type AgentStatus, createAgent, createAgentVersion, setAgentStatus, updateAgent } from "@vc/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { formToObject } from "@/lib/utils";

/** Moves the ai_* form fields into the aiSettings object expected by the services. */
function withAiSettings(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const aiSettings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("ai_")) aiSettings[k.slice(3)] = v;
    else out[k] = v;
  }
  if (out.aiProvider) out.aiSettings = aiSettings;
  else out.aiModel = "";
  return out;
}

export async function createAgentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const res = await runAction((ctx) => createAgent(ctx, withAiSettings(formToObject(form, ["allowedTools"])) as never));
  if (!res.ok) return res;
  revalidatePath("/agents");
  redirect(`/agents/${res.data.id}`);
}

export async function updateAgentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, ...rest } = formToObject(form);
  const res = await runAction((ctx) => updateAgent(ctx, String(id), rest as never));
  if (!res.ok) return res;
  revalidatePath(`/agents/${id}`);
  revalidatePath("/agents");
  return { ok: true, message: "Perfil atualizado." };
}

export async function createAgentVersionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, ...rest } = formToObject(form, ["allowedTools"]);
  const res = await runAction((ctx) => createAgentVersion(ctx, String(id), withAiSettings(rest) as never));
  if (!res.ok) return res;
  revalidatePath(`/agents/${id}`);
  return { ok: true, message: `Versão ${res.data.version} criada e ativada.` };
}

export async function activateAgentVersionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const res = await runAction((ctx) => activateAgentVersion(ctx, id, String(form.get("versionId"))));
  if (!res.ok) return res;
  revalidatePath(`/agents/${id}`);
  return { ok: true, message: `Versão ${res.data.version} ativada.` };
}

export async function setAgentStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const res = await runAction((ctx) => setAgentStatus(ctx, id, String(form.get("status")) as AgentStatus));
  if (!res.ok) return res;
  revalidatePath(`/agents/${id}`);
  revalidatePath("/agents");
  revalidatePath("/");
  return { ok: true, message: "Status atualizado." };
}
