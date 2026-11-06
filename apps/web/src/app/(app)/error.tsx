"use client";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-danger/30 bg-danger/5 p-6 text-center">
      <CircleAlert className="mx-auto mb-3 size-8 text-danger" />
      <h2 className="font-semibold">Não foi possível carregar esta página</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Você pode não ter permissão para este recurso, ou ocorreu um erro inesperado.
        {error.digest && <span className="mt-2 block font-mono text-xs">Referência: {error.digest}</span>}
      </p>
      <Button className="mt-4" variant="secondary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
