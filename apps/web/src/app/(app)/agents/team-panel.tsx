"use client";
import { Sparkles } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { seedInitialTeamAction } from "../actions/team";

/** Shortcut to register the initial team (idempotent server action). */
export function InitialTeamCard({ registered, total }: { registered: number; total: number }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-medium">Equipe inicial da Virtual Company</p>
        <p className="text-sm text-muted-foreground">
          {registered}/{total} funcionários cadastrados. Cadastra Alex (COO), 5 diretores e 5 especialistas nos departamentos existentes,
          criando apenas os que faltarem. Seguro executar mais de uma vez: nada existente é alterado.
        </p>
      </div>
      <ActionForm action={seedInitialTeamAction} className="flex shrink-0 flex-col items-end gap-2">
        <SubmitButton pendingText="Cadastrando…">
          <Sparkles /> Cadastrar equipe inicial
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
