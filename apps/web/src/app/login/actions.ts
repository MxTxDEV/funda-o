"use server";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import type { ActionState } from "@/lib/action-state";

const MESSAGES: Record<string, string> = {
  rate_limited: "Muitas tentativas de login. Aguarde alguns minutos.",
  locked: "Conta temporariamente bloqueada por tentativas inválidas. Tente novamente em 15 minutos.",
  unavailable: "Serviço temporariamente indisponível. Tente novamente.",
};

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof CredentialsSignin) {
      return { ok: false, message: MESSAGES[err.code] ?? "E-mail ou senha inválidos." };
    }
    if (err instanceof AuthError) return { ok: false, message: "Não foi possível entrar. Tente novamente." };
    throw err; // NEXT_REDIRECT on success
  }
}
