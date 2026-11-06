"use server";
import { assignTask, cancelTask, createTask, dispatchTask } from "@vc/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { formToObject } from "@/lib/utils";

export async function createTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = formToObject(form);
  // Demo processor parameters come from dedicated form fields.
  const input = {
    steps: raw.steps,
    requireApproval: raw.requireApproval === "on",
    failTimes: raw.failTimes,
  };
  const res = await runAction((ctx) =>
    createTask(ctx, {
      title: raw.title as string,
      description: raw.description as string,
      type: raw.type as "demo.lifecycle",
      priority: raw.priority as never,
      assignedAgentId: raw.assignedAgentId as string,
      maxAttempts: raw.maxAttempts as never,
      dispatch: raw.dispatch as string,
      input,
    }),
  );
  if (!res.ok) return res;
  revalidatePath("/tasks");
  revalidatePath("/");
  redirect(`/tasks/${res.data.task.id}`);
}

function taskId(form: FormData) {
  return String(form.get("id"));
}

function refresh(id: string) {
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function dispatchTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = taskId(form);
  const res = await runAction((ctx) => dispatchTask(ctx, id));
  if (!res.ok) return res;
  refresh(id);
  return {
    ok: true,
    message: res.data.enqueued
      ? "Tarefa enviada para a fila."
      : "Tarefa marcada como na fila; o worker a reprocessará assim que a fila estiver disponível.",
  };
}

export async function cancelTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = taskId(form);
  const res = await runAction((ctx) => cancelTask(ctx, id, String(form.get("reason") ?? "")));
  if (!res.ok) return res;
  refresh(id);
  return { ok: true, message: "Tarefa cancelada." };
}

export async function assignTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = taskId(form);
  const res = await runAction((ctx) => assignTask(ctx, id, String(form.get("assignedAgentId"))));
  if (!res.ok) return res;
  refresh(id);
  return { ok: true, message: "Responsável atualizado." };
}
