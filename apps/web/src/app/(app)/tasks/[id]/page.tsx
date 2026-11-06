import { ACTIVE_STATUSES, CANCELLABLE_STATUSES, can, getTask, listAgentRuns, listAgents, listTaskSources, listToolExecutions, TASK_EVENT_LABELS, TASK_TYPES } from "@vc/core";
import { ToolExecutionsTable } from "@/components/tool-executions-table";
import { Ban, Play, RotateCcw, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { AgentRunsTable, formatCost, formatTokens } from "@/components/agent-runs-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { ApprovalStatusBadge, DemoBadge, PriorityBadge, TaskStatusBadge } from "@/components/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { handlePageError } from "@/lib/page-errors";
import { scheduleDrain } from "@/lib/drain";
import { getServiceContext } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { assignTaskAction, cancelTaskAction, dispatchTaskAction } from "../../actions/tasks";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

type AgentOutput = {
  output: string;
  truncated?: boolean;
  provider?: string;
  model?: string;
  costUsd?: number | null;
  usage?: { inputTokens: number; outputTokens: number } | null;
  agent?: { name: string; version: number };
  notice?: string;
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const task = await getTask(ctx, id).catch(handlePageError);
  const canWrite = can(ctx.actor, "tasks:write");
  const isActive = ACTIVE_STATUSES.includes(task.status);
  // Resume pending work (retries with backoff, interrupted runs) in serverless mode.
  if (task.status === "queued" || task.status === "in_progress") scheduleDrain();
  const canAssign = canWrite && (task.status === "pending" || task.status === "failed");
  const agents = canAssign ? await listAgents(ctx, { status: "active" }) : [];
  const typeDef = TASK_TYPES[task.type as keyof typeof TASK_TYPES];
  const isAi = task.type === "agent.execute";
  const [runs, toolRows, sources] = isAi
    ? await Promise.all([listAgentRuns(ctx, { taskId: task.id, limit: 50 }), listToolExecutions(ctx, { taskId: task.id, limit: 100 }), listTaskSources(ctx, task.id)])
    : [[], [], []];
  const aiResult = isAi && task.result?.kind === "agent_output" ? (task.result as AgentOutput) : null;

  return (
    <>
      {isActive && <AutoRefresh intervalMs={2500} />}
      <PageHeader
        eyebrow="Tarefa"
        title={task.title}
        description={task.description || undefined}
        actions={
          <>
            {task.isDemo && <DemoBadge />}
            <TaskStatusBadge status={task.status} />
            {canWrite && (task.status === "pending" || task.status === "failed") && (
              <ActionForm action={dispatchTaskAction}>
                <input type="hidden" name="id" value={task.id} />
                <SubmitButton size="sm" disabled={!task.assignedAgentId}>
                  {task.status === "failed" ? <RotateCcw /> : <Play />}
                  {task.status === "failed" ? "Tentar novamente" : "Enviar para a fila"}
                </SubmitButton>
              </ActionForm>
            )}
            {canWrite && CANCELLABLE_STATUSES.includes(task.status) && (
              <ActionForm action={cancelTaskAction} confirm="Cancelar esta tarefa?">
                <input type="hidden" name="id" value={task.id} />
                <SubmitButton size="sm" variant="destructive">
                  <Ban /> Cancelar
                </SubmitButton>
              </ActionForm>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
              {isActive && <span className="text-xs text-primary">Atualizando automaticamente…</span>}
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {task.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{TASK_EVENT_LABELS[e.type] ?? e.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)} · {e.actorType === "user" ? "usuário" : e.actorType}
                      </span>
                    </div>
                    {e.message && <p className="text-sm text-muted-foreground">{e.message}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {aiResult && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Resultado de {aiResult.agent?.name ?? "funcionário"}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {aiResult.provider}/{aiResult.model} · versão v{aiResult.agent?.version ?? "—"} · tokens {formatTokens(aiResult.usage?.inputTokens ?? null, aiResult.usage?.outputTokens ?? null)} · {formatCost(aiResult.costUsd ?? null)}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiResult.truncated && (
                  <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    A resposta foi cortada pelo limite de tokens de saída configurado para o funcionário.
                  </p>
                )}
                <div className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-4 text-sm leading-relaxed" data-testid="ai-output">
                  {aiResult.output}
                </div>
                <p className="text-xs text-muted-foreground">{aiResult.notice}</p>
              </CardContent>
            </Card>
          )}

          {isAi && (
            <Card>
              <CardHeader>
                <CardTitle>Execuções de IA</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <AgentRunsTable runs={runs} showTask={false} empty="O modelo ainda não foi chamado para esta tarefa." />
              </CardContent>
            </Card>
          )}

          {isAi && toolRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ferramentas utilizadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ToolExecutionsTable rows={toolRows} showTask={false} empty="" />
              </CardContent>
            </Card>
          )}

          {isAi && sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fontes e referências ({sources.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm" data-testid="task-sources">
                  {sources.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[#9dbbff] hover:underline">
                        {s.title || s.url}
                      </a>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {s.kind === "web_page" ? "página lida" : "resultado de busca"} · {formatDateTime(s.retrievedAt)}
                      </span>
                      <div className="truncate text-xs text-muted-foreground">{s.url}</div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!aiResult && (task.result || task.error) && (
            <Card>
              <CardHeader>
                <CardTitle>{task.error && task.status !== "completed" ? "Erro" : "Resultado"}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-xs">
                  {JSON.stringify(task.status === "failed" ? task.error : (task.result ?? task.error), null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {task.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Aprovações</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {task.approvals.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <Link href={`/approvals/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {a.title}
                      </Link>
                      <ApprovalStatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border py-1">
              <Meta label="Tipo">{typeDef?.label ?? task.type}</Meta>
              <Meta label="Prioridade">
                <PriorityBadge priority={task.priority} />
              </Meta>
              <Meta label="Responsável">
                {task.agent ? (
                  <Link href={`/agents/${task.agent.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <AgentAvatar seed={task.agent.avatarSeed} url={task.agent.avatarUrl} name={task.agent.name} size={22} />
                    {task.agent.name}
                  </Link>
                ) : (
                  "—"
                )}
              </Meta>
              <Meta label="Departamento">{task.department?.name ?? "—"}</Meta>
              <Meta label="Tentativas">
                {task.attempts} (máx. {task.maxAttempts} por execução)
              </Meta>
              <Meta label="Execuções">{task.runCount}</Meta>
              <Meta label="Criada">{formatDateTime(task.createdAt)}</Meta>
              <Meta label="Iniciada">{formatDateTime(task.startedAt)}</Meta>
              <Meta label="Finalizada">{formatDateTime(task.finishedAt)}</Meta>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entrada</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-xs">{JSON.stringify(task.input, null, 2)}</pre>
            </CardContent>
          </Card>

          {canAssign && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRoundCog className="size-4" /> Atribuir responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={assignTaskAction} className="space-y-3">
                  <input type="hidden" name="id" value={task.id} />
                  <Select name="assignedAgentId" defaultValue={task.assignedAgentId ?? ""} required aria-label="Responsável">
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.title}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton variant="secondary" className="w-full">
                    Atribuir
                  </SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
