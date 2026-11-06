"use server";
import { changeOwnPassword } from "@vc/core";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";

/** Changes the signed-in user's password. All sessions (including this one) are invalidated. */
export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const res = await runAction(async (ctx) => {
    if (ctx.actor.type !== "user") throw new Error("user session required");
    await changeOwnPassword(
      ctx.db,
      ctx.actor,
      {
        currentPassword: String(form.get("currentPassword") ?? ""),
        newPassword: String(form.get("newPassword") ?? ""),
        confirmPassword: String(form.get("confirmPassword") ?? ""),
      },
      ctx.meta,
    );
  });
  if (!res.ok) return res;
  return { ok: true, message: "Senha alterada. Entre novamente com a nova senha." };
}
