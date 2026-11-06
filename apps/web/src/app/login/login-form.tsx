"use client";
import { LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required maxLength={254} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Verificando...">
        <LockKeyhole /> Entrar no centro de comando
      </SubmitButton>
    </form>
  );
}
