import { can, getAiOverview, listAgentRuns, usageToday } from "@vc/core";
import { CircleCheck, CircleX, KeyRound, PlugZap } from "lucide-react";
import { AgentRunsTable } from "@/components/agent-runs-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceContext } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { testProviderAction } from "../actions/ai";

export const metadata = { title: "IA e execuções" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default async function AiPage() {
  const ctx = await getServiceContext();
  const canWrite = can(ctx.actor, "agents:write");
  const [overview, runs, today] = await Promise.all([getAiOverview(ctx), listAgentRuns(ctx, { limit: 30 }), usageToday(ctx.db)]);
  const running = runs.some((r) => r.status === "running");
  const { limits } = overview;

  return (
    <>
      {running && <AutoRefresh intervalMs={3000} />}
      <PageHeader
        eyebrow="Central Brain"
        title="IA e execuções"
        description="Provedores de IA, limites da empresa e o registro de cada execução real dos funcionários."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {overview.providers.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PlugZap className="size-4" /> {p.label}
                </CardTitle>
                <CardDescription>
                  Credencial lida da variável de ambiente <code className="font-mono">{p.credentialEnv}</code> no servidor.
                </CardDescription>
              </div>
              {p.configured ? <Badge tone="green">Credencial configurada</Badge> : <Badge tone="amber">Sem credencial</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="divide-y divide-border">
                <Row label="Última verificação">
                  {p.lastCheck ? (
                    <span className="inline-flex items-center gap-1">
                      {p.lastCheck.ok ? <CircleCheck className="size-3.5 text-success" /> : <CircleX className="size-3.5 text-[#ff8a8a]" />}
                      {formatDateTime(p.lastCheck.checkedAt)}
                    </span>
                  ) : (
                    "Nunca verificado"
                  )}
                </Row>
                {p.lastCheck && <Row label="Resultado">{p.lastCheck.message}</Row>}
                {p.lastCheck?.latencyMs != null && <Row label="Latência">{p.lastCheck.latencyMs} ms</Row>}
                {p.customBaseUrl && <Row label="Endpoint">personalizado</Row>}
              </div>
              {p.lastCheck?.ok && p.lastCheck.models.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Modelos informados pelo provedor ({p.lastCheck.models.length})</summary>
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto font-mono">
                    {p.lastCheck.models.map((m) => (
                      <li key={m.id}>
                        {m.id}
                        {m.displayName ? <span className="text-muted-foreground"> — {m.displayName}</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {canWrite && (
                <ActionForm action={testProviderAction}>
                  <input type="hidden" name="provider" value={p.id} />
                  <SubmitButton size="sm" variant="outline" disabled={!p.configured} pendingText="Verificando…">
                    Verificar conexão e atualizar modelos
                  </SubmitButton>
                </ActionForm>
              )}
              {!p.configured && (
                <p className="text-xs text-muted-foreground">
                  Para conectar, cadastre <code className="font-mono">{p.credentialEnv}</code> nas variáveis de ambiente do projeto (Vercel → Settings → Environment
                  Variables) e faça um novo deploy. A chave nunca é exibida nem gravada no banco.
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> Limites e controles da empresa
              </CardTitle>
              <CardDescription>Configurados por variáveis de ambiente do servidor.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="Execução de IA">{limits.enabled ? <Badge tone="green">Ativada</Badge> : <Badge tone="red">Desativada (AI_EXECUTION_ENABLED)</Badge>}</Row>
            <Row label="Limite diário de tokens">{limits.dailyTokenLimit?.toLocaleString("pt-BR") ?? "sem limite"}</Row>
            <Row label="Limite diário de custo">{limits.dailyCostLimitUsd !== null ? `US$ ${limits.dailyCostLimitUsd}` : "sem limite"}</Row>
            <Row label="Tempo limite por chamada">{Math.round(limits.requestTimeoutMs / 1000)} s</Row>
            <Row label="Modelos com preço configurado">{overview.pricedModels.length ? overview.pricedModels.join(", ") : "nenhum (custo indisponível)"}</Row>
            <Row label="Hoje">
              {today.runs} execuções · {today.tokens.toLocaleString("pt-BR")} tokens{today.costUsd > 0 ? ` · US$ ${today.costUsd.toFixed(4)}` : ""}
            </Row>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Execuções recentes</CardTitle>
            <CardDescription>Cada linha é uma chamada real a um modelo. Custos são estimados a partir dos preços configurados em AI_MODEL_PRICING.</CardDescription>
          </div>
          {running && <span className="text-xs text-primary">Atualizando automaticamente…</span>}
        </CardHeader>
        <CardContent className="p-0">
          <AgentRunsTable runs={runs} empty="Nenhuma execução de IA registrada ainda." />
        </CardContent>
      </Card>
    </>
  );
}
