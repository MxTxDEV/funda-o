import type { Metadata } from "next";
import { Logo } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className="glow-top relative grid min-h-dvh place-items-center px-4">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-border-strong bg-surface/90 p-6 shadow-[0_30px_80px_-30px_rgba(61,123,255,0.45)] backdrop-blur">
          <h1 className="text-lg font-semibold tracking-tight">Acesso administrativo</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre para administrar a Virtual Company.</p>
          {expired && (
            <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning" role="status">
              Sua sessão foi encerrada (por exemplo, após troca de senha). Entre novamente.
            </p>
          )}
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Acesso restrito. Todas as ações são auditadas.</p>
      </div>
    </main>
  );
}
