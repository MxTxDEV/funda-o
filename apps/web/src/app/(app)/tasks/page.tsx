import { can, listTasks, TASK_STATUS_LABELS, TASK_STATUSES } from "@vc/core";
import { ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, PageHeader } from "@/components/page-header";
import { DemoBadge, PriorityBadge, TaskStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServiceContext } from "@/lib/session";
import { cn, formatRelative } from "@/lib/utils";

export const metadata = { title: "Tarefas" };

type SP = { status?: string; agentId?: string; page?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await getServiceContext();
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = 25;
  const status = TASK_STATUSES.find((s) => s === sp.status);
  const { items, total } = await listTasks(ctx, { status, agentId: sp.agentId, limit, offset: (page - 1) * limit });
  const pages = Math.max(1, Math.ceil(total / limit));
  const qs = (p: Partial<SP>) => {
    const params = new URLSearchParams();
    const merged = { status, agentId: sp.agentId, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/tasks?${s}` : "/tasks";
  };

  return (
    <>
      <AutoRefresh intervalMs={7000} />
      <PageHeader
        eyebrow="Operação"
        title="Tarefas"
        description="Crie, atribua, acompanhe e cancele tarefas dos funcionários virtuais."
        actions={
          can(ctx.actor, "tasks:write") && (
            <Button asChild>
              <Link href="/tasks/new">
                <Plus /> Nova tarefa
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[undefined, ...TASK_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={qs({ status: s, page: undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              status === s ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s ? TASK_STATUS_LABELS[s] : "Todas"}
          </Link>
        ))}
        {sp.agentId && (
          <Link href={qs({ agentId: undefined })} className="rounded-full border border-cyan/40 px-3 py-1 text-xs text-cyan">
            Filtrado por funcionário ✕
          </Link>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<ListTodo />} title="Nenhuma tarefa encontrada" />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tarefa</TH>
                  <TH>Responsável</TH>
                  <TH>Prioridade</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Atualizada</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((t) => (
                  <TR key={t.id}>
                    <TD className="max-w-md">
                      <Link href={`/tasks/${t.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <span className="truncate">{t.title}</span>
                        {t.isDemo && <DemoBadge />}
                      </Link>
                      <span className="text-xs text-muted-foreground">{t.type}</span>
                    </TD>
                    <TD>
                      {t.agent ? (
                        <span className="flex items-center gap-2">
                          <AgentAvatar seed={t.agent.avatarSeed} url={t.agent.avatarUrl} name={t.agent.name} size={24} />
                          <span className="truncate text-sm">{t.agent.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não atribuída</span>
                      )}
                    </TD>
                    <TD>
                      <PriorityBadge priority={t.priority} />
                    </TD>
                    <TD>
                      <TaskStatusBadge status={t.status} />
                    </TD>
                    <TD className="text-right text-xs text-muted-foreground">{formatRelative(t.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} tarefas · página {page} de {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={qs({ page: String(page - 1) })}>Anterior</Link>
              </Button>
            )}
            {page < pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={qs({ page: String(page + 1) })}>Próxima</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
