"use server";
import { seedInitialTeam } from "@vc/core";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";

/** Registers the initial team (idempotent). Requires agents:write and departments:write. */
export async function seedInitialTeamAction(_prev: ActionState, _form: FormData): Promise<ActionState> {
  const res = await runAction((ctx) => seedInitialTeam(ctx));
  if (!res.ok) return res;
  revalidatePath("/agents");
  revalidatePath("/office");
  revalidatePath("/");
  const r = res.data;
  const parts = [
    `${r.createdAgents.length} funcionário(s) cadastrado(s)`,
    r.adoptedAgents.length ? `${r.adoptedAgents.length} já existente(s) vinculado(s)` : null,
    r.createdDepartments.length ? `departamentos criados: ${r.createdDepartments.join(", ")}` : null,
    r.warnings.length ? `avisos: ${r.warnings.join(" ")}` : null,
  ].filter(Boolean);
  return { ok: true, message: parts.join(" · ") + "." };
}
