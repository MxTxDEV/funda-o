import { getDashboard, PRESENCE_LABELS, PRESENCE_STATES, TASK_EVENT_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from "@vc/core";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCheck,
  CircleAlert,
  Cpu,
  FlaskConical,
  ListTodo,
  Plus,
  Server,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { OfficeFloor } from "@/components/office-floor";
import { EmptyState, PageHeader } from "@/components/page-header";
import { DemoBadge, PRESENCE_COLORS } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isServerlessExecution, scheduleDrain } from "@/lib/drain";
import { getServiceContext } from "@/lib/session";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "#4b5563",
  queued: "#22d3ee",
  in_progress: "#3d7bff",
  waiting_approval: "#f5a524",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#2f3949",
};

function Kpi({ icon, label, value, hint, href }: { icon: React.ReactNode; label: string; value: number | string; hint?: string; href: string }) {
  return (
    <Link href={href} className="group">
      <Card className="relative h-full overflow-hidden transition-colors group-hover:border-primary/50">
        <CardContent className="flex items-start justify-between gap-3 py-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <span className="grid size-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary [&_svg]:size-4">{icon}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const ctx = await getServiceContext();
  const d = await getDashboard(ctx);
  const activeTasks = (d.tasks.byStatus.queued ?? 0) + (d.tasks.byStatus.in_progress ?? 0) + (d.tasks.byStatus.waiting_approval ?? 0);
  if (d.queue && d.queue.waiting + d.queue.delayed > 0) scheduleDrain();
  const serverless = isServerlessExecution();
  const isEmpty = d.departments.total === 0 && d.agents.total === 0 && d.tasks.total === 0;

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <PageHeader
        eyebrow="Centro de comando"
        title={`Olá, ${ctx.actor.name.split(" ")[0]}`}
        description="Visão em tempo real da operação: equipe, tarefas, fila de execução e aprovações."
        actions={
          <>
            {d.hasDemoData && <DemoBadge />}
            <Button asChild variant="secondary">
              <Link href="/agents/new">
                <Users /> Novo funcionário
              </Link>
            </Button>
            <Button asChild>
              <Link href="/tasks/new">
                <Plus /> Nova tarefa
              </Link>
            </Button>
          </>
        }
      />

      {d.hasDemoData && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-violet/30 bg-violet/10 px-4 py-2.5 text-sm text-violet">
          <FlaskConical className="size-4 shrink-0" />
          <span>
            Existem dados de demonstração no banco (marcados com DEMO). Remova-os com{" "}
            <code className="rounded bg-black/30 px-1">pnpm db:demo:purge</code>.
          </span>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<Building2 />}
          title="Sua empresa virtual ainda está vazia"
          description="Comece criando um departamento e depois contrate (cadastre) os funcionários virtuais."
          action={
            <Button asChild>
              <Link href="/departments">
                Criar primeiro departamento <ArrowRight />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={<Building2 />} label="Departamentos ativos" value={d.departments.active} hint={`${d.departments.total} no total`} href="/departments" />
            <Kpi icon={<Users />} label="Funcionários" value={d.agents.total} hint={`${d.presence.working ?? 0} trabalhando agora`} href="/agents" />
            <Kpi icon={<ListTodo />} label="Tarefas ativas" value={activeTasks} hint={`${d.tasks.finishedLast24h.completed ?? 0} concluídas em 24h`} href="/tasks" />
            <Kpi icon={<CheckCheck />} label="Aprovações pendentes" value={d.approvals.pending} hint="Decisões aguardando você" href="/approvals?status=pending" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Escritório</CardTitle>
                  <CardDescription>Presença sincronizada com as tarefas. Visual 2D provisório — o escritório 3D virá em fase futura.</CardDescription>
                </div>
                <div className="hidden flex-wrap justify-end gap-3 md:flex">
                  {PRESENCE_STATES.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ background: PRESENCE_COLORS[s] }} />
                      {PRESENCE_LABELS[s]} <b className="tabular-nums text-foreground">{d.presence[s] ?? 0}</b>
                    </span>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {d.floor.length ? (
                  <OfficeFloor agents={d.floor} />
                ) : (
                  <EmptyState icon={<Users />} title="Nenhum funcionário cadastrado" action={<Button asChild size="sm"><Link href="/agents/new">Cadastrar funcionário</Link></Button>} />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Execução</CardTitle>
                    <CardDescription>Fila BullMQ e worker</CardDescription>
                  </div>
                  {d.queue ? (
                    serverless && !d.queue.workerOnline ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-cyan" title="Tarefas são processadas na Vercel quando entram na fila">
                        <Server className="size-3.5" /> Sob demanda (Vercel)
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-xs ${d.queue.workerOnline ? "text-success" : "text-danger"}`}>
                        <Server className="size-3.5" /> Worker {d.queue.workerOnline ? "online" : "offline"}
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
                      <CircleAlert className="size-3.5" /> Fila indisponível
                    </span>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-center">
                  {d.queue ? (
                    [
                      ["Aguardando", d.queue.waiting + d.queue.delayed],
                      ["Executando", d.queue.active],
                      ["Falhas (retidas)", d.queue.failed],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-md border border-border bg-surface-2/50 py-3">
                        <p className="text-xl font-semibold tabular-nums">{value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-3 text-sm text-muted-foreground">Não foi possível consultar o Redis.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Tarefas por estado</CardTitle>
                    <CardDescription>{d.tasks.total} tarefas registradas</CardDescription>
                  </div>
                  <Cpu className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
                    {d.tasks.total > 0 &&
                      TASK_STATUSES.map((s) => {
                        const v = d.tasks.byStatus[s] ?? 0;
                        return v ? <span key={s} style={{ width: `${(v / d.tasks.total) * 100}%`, background: STATUS_BAR_COLORS[s] }} /> : null;
                      })}
                  </div>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {TASK_STATUSES.map((s) => (
                      <li key={s} className="flex items-center justify-between">
                        <Link href={`/tasks?status=${s}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                          <span className="size-2 rounded-sm" style={{ background: STATUS_BAR_COLORS[s] }} />
                          {TASK_STATUS_LABELS[s]}
                        </Link>
                        <span className="tabular-nums">{d.tasks.byStatus[s] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Atividade operacional</CardTitle>
                <CardDescription>Eventos mais recentes do ciclo de vida das tarefas</CardDescription>
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0">
              {d.recentEvents.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {d.recentEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">{formatRelative(e.createdAt)}</span>
                      <span className="w-48 shrink-0 truncate text-xs font-medium text-[#9dbbff]">{TASK_EVENT_LABELS[e.type] ?? e.type}</span>
                      <Link href={`/tasks/${e.taskId}`} className="min-w-0 flex-1 truncate hover:underline">
                        {e.taskTitle}
                        {e.message && e.message !== e.taskTitle && <span className="text-muted-foreground"> — {e.message}</span>}
                      </Link>
                      {e.taskIsDemo && <DemoBadge />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
