"use client";
import { KeyRound, Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";
import { Field, FormMessage } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "../actions/account";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  useEffect(() => {
    // The session is invalidated by the change: go to the login page.
    if (state?.ok) {
      const t = setTimeout(() => (window.location.href = "/login"), 1800);
      return () => clearTimeout(t);
    }
  }, [state]);
  return (
    <form
      className="space-y-4"
      // Submitting manually keeps the typed values when the server returns an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <Field label="Senha atual" name="currentPassword" state={state}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={200} />
      </Field>
      <Field label="Nova senha" name="newPassword" state={state} hint="Mínimo de 12 caracteres, com pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
      </Field>
      <Field label="Confirmar nova senha" name="confirmPassword" state={state}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || !!state?.ok}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} {pending ? "Alterando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
