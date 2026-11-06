"use server";
import { createDepartment, setDepartmentActive, updateDepartment } from "@vc/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { formToObject } from "@/lib/utils";

export async function createDepartmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const res = await runAction((ctx) => createDepartment(ctx, formToObject(form) as never));
  if (!res.ok) return res;
  revalidatePath("/departments");
  redirect(`/departments/${res.data.id}`);
}

export async function updateDepartmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { id, ...rest } = formToObject(form);
  const res = await runAction((ctx) => updateDepartment(ctx, String(id), rest as never));
  if (!res.ok) return res;
  revalidatePath("/departments");
  revalidatePath(`/departments/${id}`);
  return { ok: true, message: "Departamento atualizado." };
}

export async function toggleDepartmentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id"));
  const isActive = form.get("isActive") === "true";
  const res = await runAction((ctx) => setDepartmentActive(ctx, id, isActive));
  if (!res.ok) return res;
  revalidatePath("/departments");
  revalidatePath(`/departments/${id}`);
  return { ok: true, message: isActive ? "Departamento ativado." : "Departamento desativado." };
}
