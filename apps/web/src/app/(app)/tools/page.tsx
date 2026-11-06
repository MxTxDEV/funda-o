import { AUTONOMY_LABELS, getToolRegistryOverview, listToolExecutions, TOOL_AVAILABILITY_LABELS, TOOL_CATEGORY_LABELS } from "@vc/core";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ToolExecutionsTable } from "@/components/tool-executions-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceContext } from "@/lib/session";

export const metadata = { title: "Ferramentas" };

export default async function ToolsPage() {
  const ctx = await getServiceContext();
  const [tools, executions] = await Promise.all([getToolRegistryOverview(ctx), listToolExecutions(ctx, { limit: 40 })]);

  return (
    <>
      <PageHeader
        eyebrow="Operations Engine"
        title="Ferramentas"
        description="Registro central das ferramentas que os funcionários podem usar, com permissões, nível de risco, limites e histórico de execução."
      />

      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Níveis de autonomia</CardTitle>
            <CardDescription>Definidos pelo proprietário em cada funcionário. Nenhum funcionário altera o próprio nível.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(AUTONOMY_LABELS).map(([level, l]) => (
            <div key={level} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">{l.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {tools.map((t) => (
          <Card key={t.id} data-testid={`tool-${t.id}`}>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>{t.label}</CardTitle>
                <CardDescription className="font-mono text-[11px]">{t.id}</CardDescription>
              </div>
              {t.status === "planned" ? (
                <Badge tone="neutral">Planejada</Badge>
              ) : t.missingEnv.length ? (
                <Badge tone="amber">Requer configuração</Badge>
              ) : (
                <Badge tone="green">Disponível</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{t.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="blue">{TOOL_CATEGORY_LABELS[t.category]}</Badge>
                <Badge tone={t.riskLevel >= 3 ? "red" : t.riskLevel === 2 ? "amber" : "neutral"}>Exige {AUTONOMY_LABELS[t.riskLevel].name}</Badge>
                <Badge tone="neutral">
                  Limites: {t.limits.perRun}/execução · {t.limits.perDayPerAgent}/dia por funcionário
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Permissões: {t.permissions.join(" · ")}</p>
              {t.missingEnv.length > 0 && (
                <p className="text-xs text-warning">
                  Cadastre no servidor: <code className="font-mono">{t.missingEnv.join(", ")}</code>
                </p>
              )}
              <div className="text-xs">
                <p className="mb-1 text-muted-foreground">
                  Uso: {t.usage.today} hoje · {t.usage.total} no total · {t.usage.failed} falhas · {t.usage.denied} recusadas
                </p>
                {t.employees.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum funcionário ativo autorizado.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {t.employees.map((e) => (
                      <li key={e.id}>
                        <Link href={`/agents/${e.id}`} title={TOOL_AVAILABILITY_LABELS[e.reason]}>
                          <Badge tone={e.reason === "ok" ? "green" : "neutral"}>
                            {e.name}
                            {e.reason === "ok" ? "" : ` · ${TOOL_AVAILABILITY_LABELS[e.reason]}`}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Histórico de execução</CardTitle>
            <CardDescription>Toda chamada de ferramenta feita por um modelo, inclusive as recusadas pelo controle de permissões.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ToolExecutionsTable rows={executions} empty="Nenhuma ferramenta foi executada ainda." />
        </CardContent>
      </Card>
    </>
  );
}
