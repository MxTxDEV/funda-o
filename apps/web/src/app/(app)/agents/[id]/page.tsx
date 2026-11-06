import {
  AI_CONNECTION_LABELS,
  aiConnectionOf,
  can,
  getAgent,
  getAgentWorkstation,
  getDepartmentZone,
  getTool,
  HIERARCHY_LABELS,
  listAgents,
  listDepartments,
  TASK_STATUS_LABELS,
} from "@vc/core";
import { Archive, History, Pause, Play } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { AgentStatusBadge, DemoBadge, PresenceBadge, TaskStatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { handlePageError } from "@/lib/page-errors";
import { getServiceContext } from "@/lib/session";
import { formatDateTime, formatRelative } from "@/lib/utils";
import {
  activateAgentVersionAction,
  createAgentVersionAction,
  setAgentStatusAction,
  updateAgentAction,
} from "../../actions/agents";
import { ToolPicker } from "../tool-picker";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const agent = await getAgent(ctx, id).catch(handlePageError);
  const canWrite = can(ctx.actor, "agents:write");
  const [departments, colleagues, workstation] = await Promise.all([
    canWrite ? listDepartments(ctx, { activeOnly: true }) : Promise.resolve([]),
    canWrite ? listAgents(ctx) : Promise.resolve([]),
    getAgentWorkstation(ctx, agent.id),
  ]);
  const managers = colleagues.filter((c) => c.id !== agent.id && c.hierarchyLevel !== "specialist");
  const ai = aiConnectionOf(agent.currentVersion?.aiProvider, agent.currentVersion?.aiModel);
  const current = agent.currentVersion;

  const statusButton = (status: "active" | "paused" | "archived", label: string, icon: React.ReactNode, confirm?: string) => (
    <ActionForm action={setAgentStatusAction} confirm={confirm}>
      <input type="hidden" name="id" value={agent.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton size="sm" variant="outline">
        {icon} {label}
      </SubmitButton>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        eyebrow={agent.department.name}
        title={
          <span className="flex items-center gap-4">
            <AgentAvatar seed={agent.avatarSeed} url={agent.avatarUrl} appearance={agent.appearance} name={agent.name} size={56} presence={agent.presence?.state} />
            <span>
              {agent.name}
              <span className="block text-sm font-normal text-muted-foreground">
                {agent.title} · {agent.specialty}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {agent.isDemo && <DemoBadge />}
            <AgentStatusBadge status={agent.status} />
            {agent.presence && <PresenceBadge state={agent.presence.state} />}
            {canWrite && agent.status !== "active" && statusButton("active", "Ativar", <Play />)}
            {canWrite && agent.status === "active" && statusButton("paused", "Pausar", <Pause />)}
            {canWrite && agent.status !== "archived" && statusButton("archived", "Arquivar", <Archive />, "Arquivar este funcionário?")}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Perfil profissional</CardTitle>
              <Link href={`/audit?entityType=agent&entityId=${agent.id}`} className="text-xs text-primary hover:underline">
                Histórico de alterações
              </Link>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hierarquia</p>
                  <p>{HIERARCHY_LABELS[agent.hierarchyLevel]}</p>
                  <p className="text-xs text-muted-foreground">
                    Reporta a:{" "}
                    {agent.reportsTo ? (
                      <Link className="text-foreground hover:underline" href={`/agents/${agent.reportsTo.id}`}>
                        {agent.reportsTo.name}
                      </Link>
                    ) : (
                      "Proprietário"
                    )}
                  </p>
                  {agent.directReports.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Lidera:{" "}
                      {agent.directReports.map((r, i) => (
                        <span key={r.id}>
                          <Link className="text-foreground hover:underline" href={`/agents/${r.id}`}>
                            {r.name}
                          </Link>
                          {i < agent.directReports.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Personalidade profissional</p>
                  <p>{agent.personality || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Modelo de IA</p>
                  <p>{agent.currentVersion?.aiProvider ? `${agent.currentVersion.aiProvider} · ${agent.currentVersion.aiModel ?? "—"}` : "Não configurado"}</p>
                  <p className="text-xs text-warning">{AI_CONNECTION_LABELS[ai]}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estação de trabalho</p>
                  <p>
                    {workstation.resting
                      ? "Sala de Lazer (pausado)"
                      : workstation.zone
                        ? `${getDepartmentZone(workstation.zone)?.label} · mesa ${workstation.desk}`
                        : "Sem sala no escritório"}
                  </p>
                  <p className="text-xs text-muted-foreground">Cadastrado em {formatDateTime(agent.createdAt)}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.specialties.length ? agent.specialties.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Responsabilidades</p>
                  {agent.responsibilities.length ? (
                    <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                      {agent.responsibilities.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Versão ativa {current ? `v${current.version}` : ""}</CardTitle>
                <CardDescription>{current?.changeNote}</CardDescription>
              </div>
              {current && <span className="text-xs text-muted-foreground">{formatDateTime(current.createdAt)}</span>}
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed">
                {current?.instructions ?? "Sem versão ativa."}
              </pre>
              <div className="flex flex-wrap gap-2">
                {(current?.allowedTools ?? []).length === 0 && <span className="text-xs text-muted-foreground">Nenhuma ferramenta autorizada.</span>}
                {(current?.allowedTools ?? []).map((t) => (
                  <Badge key={t} tone="blue">
                    {getTool(t)?.label ?? t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {canWrite && agent.status !== "archived" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Nova versão</CardTitle>
                  <CardDescription>Instruções e ferramentas são imutáveis por versão. Salvar cria a versão {agent.versions.length + 1}.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ActionForm action={createAgentVersionAction} className="space-y-4" resetOnSuccess={false}>
                  <input type="hidden" name="id" value={agent.id} />
                  <Field label="Instruções" name="instructions">
                    <Textarea id="instructions" name="instructions" defaultValue={current?.instructions} required minLength={10} maxLength={20000} className="min-h-40 font-mono text-xs" />
                  </Field>
                  <Field label="Ferramentas autorizadas" name="allowedTools">
                    <ToolPicker selected={current?.allowedTools ?? []} />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Provedor de IA (opcional)" name="aiProvider" hint="Nenhuma integração de IA está ativa nesta fase.">
                      <Input id="aiProvider" name="aiProvider" defaultValue={current?.aiProvider ?? ""} maxLength={80} placeholder="ex.: anthropic" />
                    </Field>
                    <Field label="Modelo de IA (opcional)" name="aiModel">
                      <Input id="aiModel" name="aiModel" defaultValue={current?.aiModel ?? ""} maxLength={80} />
                    </Field>
                  </div>
                  <Field label="Nota da alteração" name="changeNote">
                    <Input id="changeNote" name="changeNote" required minLength={3} maxLength={500} placeholder="O que mudou e por quê" />
                  </Field>
                  <SubmitButton>Criar versão</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Tarefas recentes</CardTitle>
              <Link href={`/tasks?agentId=${agent.id}`} className="text-xs text-primary hover:underline">
                Ver todas
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {agent.recentTasks.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma tarefa atribuída.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {agent.recentTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {t.title}
                      </Link>
                      {t.isDemo && <DemoBadge />}
                      <TaskStatusBadge status={t.status} />
                      <span className="w-24 text-right text-xs text-muted-foreground" title={TASK_STATUS_LABELS[t.status]}>
                        {formatRelative(t.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Histórico de versões
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {agent.versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-mono text-xs text-primary">v{v.version}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{v.changeNote || "—"}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(v.createdAt)}</span>
                    </span>
                    {v.id === agent.currentVersionId ? (
                      <Badge tone="green">Ativa</Badge>
                    ) : (
                      canWrite && (
                        <ActionForm action={activateAgentVersionAction} confirm={`Ativar a versão ${v.version}?`}>
                          <input type="hidden" name="id" value={agent.id} />
                          <input type="hidden" name="versionId" value={v.id} />
                          <SubmitButton size="sm" variant="ghost">
                            Ativar
                          </SubmitButton>
                        </ActionForm>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={updateAgentAction} className="space-y-4">
                  <input type="hidden" name="id" value={agent.id} />
                  <Field label="Nome" name="name">
                    <Input id="name" name="name" defaultValue={agent.name} required minLength={2} maxLength={80} />
                  </Field>
                  <Field label="Cargo" name="title">
                    <Input id="title" name="title" defaultValue={agent.title} required minLength={2} maxLength={80} />
                  </Field>
                  <Field label="Especialidade" name="specialty">
                    <Input id="specialty" name="specialty" defaultValue={agent.specialty} required minLength={2} maxLength={120} />
                  </Field>
                  <Field label="Departamento" name="departmentId">
                    <Select id="departmentId" name="departmentId" defaultValue={agent.departmentId}>
                      {!departments.some((d) => d.id === agent.departmentId) && <option value={agent.departmentId}>{agent.department.name} (inativo)</option>}
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Descrição" name="description">
                    <Textarea id="description" name="description" defaultValue={agent.description} maxLength={2000} />
                  </Field>
                  <Field label="Especialidades (uma por linha)" name="specialties">
                    <Textarea id="specialties" name="specialties" defaultValue={agent.specialties.join("\n")} />
                  </Field>
                  <Field label="Responsabilidades (uma por linha)" name="responsibilities">
                    <Textarea id="responsibilities" name="responsibilities" defaultValue={agent.responsibilities.join("\n")} />
                  </Field>
                  <Field label="Personalidade profissional" name="personality">
                    <Input id="personality" name="personality" defaultValue={agent.personality} maxLength={500} />
                  </Field>
                  <Field label="Nível hierárquico" name="hierarchyLevel">
                    <Select id="hierarchyLevel" name="hierarchyLevel" defaultValue={agent.hierarchyLevel}>
                      <option value="specialist">Especialista</option>
                      <option value="director">Diretor de departamento</option>
                      <option value="coo">Diretor de Operações (COO)</option>
                    </Select>
                  </Field>
                  <Field label="Reporta a" name="reportsToAgentId">
                    <Select id="reportsToAgentId" name="reportsToAgentId" defaultValue={agent.reportsToAgentId ?? ""}>
                      <option value="">Proprietário</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Avatar (URL https)" name="avatarUrl">
                    <Input id="avatarUrl" name="avatarUrl" type="url" defaultValue={agent.avatarUrl ?? ""} maxLength={500} />
                  </Field>
                  <SubmitButton className="w-full" variant="secondary">
                    Salvar perfil
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
