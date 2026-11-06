import { can, getDepartment } from "@vc/core";
import { Power, Users } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AgentStatusBadge, DemoBadge, PresenceBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { handlePageError } from "@/lib/page-errors";
import { getServiceContext } from "@/lib/session";
import { toggleDepartmentAction, updateDepartmentAction } from "../../actions/departments";

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const dept = await getDepartment(ctx, id).catch(handlePageError);
  const canWrite = can(ctx.actor, "departments:write");

  return (
    <>
      <PageHeader
        eyebrow="Departamento"
        title={
          <span className="flex items-center gap-3">
            <span className="size-3 rounded-sm" style={{ background: dept.color }} />
            {dept.name}
          </span>
        }
        description={dept.description || undefined}
        actions={
          <>
            {dept.isDemo && <DemoBadge />}
            {dept.isActive ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}
            {canWrite && (
              <ActionForm
                action={toggleDepartmentAction}
                confirm={dept.isActive ? "Desativar o departamento? Novas tarefas de seus funcionários serão bloqueadas." : undefined}
              >
                <input type="hidden" name="id" value={dept.id} />
                <input type="hidden" name="isActive" value={String(!dept.isActive)} />
                <SubmitButton variant={dept.isActive ? "outline" : "success"} size="sm">
                  <Power /> {dept.isActive ? "Desativar" : "Ativar"}
                </SubmitButton>
              </ActionForm>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Equipe ({dept.agents.length})</CardTitle>
            {canWrite && dept.isActive && (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/agents/new?departmentId=${dept.id}`}>Adicionar funcionário</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {dept.agents.length === 0 ? (
              <EmptyState icon={<Users />} title="Nenhum funcionário neste departamento" />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {dept.agents.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}`} className="flex items-center gap-3 rounded-md border border-border bg-surface-2/50 p-3 hover:border-primary/50">
                      <AgentAvatar seed={a.avatarSeed} url={a.avatarUrl} name={a.name} presence={a.presence?.state} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.title}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <AgentStatusBadge status={a.status} />
                        {a.presence && <PresenceBadge state={a.presence.state} />}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {canWrite && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Editar</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateDepartmentAction} className="space-y-4">
                <input type="hidden" name="id" value={dept.id} />
                <Field label="Nome" name="name">
                  <Input id="name" name="name" defaultValue={dept.name} required minLength={2} maxLength={80} />
                </Field>
                <Field label="Descrição" name="description">
                  <Textarea id="description" name="description" defaultValue={dept.description} maxLength={500} />
                </Field>
                <Field label="Cor da sala" name="color">
                  <Input id="color" name="color" type="color" defaultValue={dept.color} className="h-9 w-20 p-1" />
                </Field>
                <SubmitButton className="w-full">Salvar alterações</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
