import { assertCan, listAgents, TASK_PRIORITY_LABELS, TASK_PRIORITIES, TASK_TYPES } from "@vc/core";
import { Cpu, FlaskConical } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getServiceContext } from "@/lib/session";
import { createTaskAction } from "../../actions/tasks";

export const metadata = { title: "Nova tarefa" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ agentId?: string }> }) {
  const { agentId } = await searchParams;
  const ctx = await getServiceContext();
  assertCan(ctx.actor, "tasks:write");
  const agents = await listAgents(ctx);

  return (
    <>
      <PageHeader eyebrow="Operação" title="Nova tarefa" description="Tarefas sem responsável ficam pendentes até serem atribuídas e enviadas para a fila." />
      <ActionForm action={createTaskAction} className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Título" name="title" className="md:col-span-2">
              <Input id="title" name="title" required minLength={3} maxLength={200} />
            </Field>
            <Field label="Descrição" name="description" className="md:col-span-2">
              <Textarea id="description" name="description" maxLength={5000} />
            </Field>
            <Field label="Tipo" name="type">
              <Select id="type" name="type" defaultValue="agent.execute">
                {Object.entries(TASK_TYPES).map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridade" name="priority">
              <Select id="priority" name="priority" defaultValue="normal">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável" name="assignedAgentId" hint="Na execução por IA, o funcionário usa o modelo configurado na versão atual dele.">
              <Select id="assignedAgentId" name="assignedAgentId" defaultValue={agentId ?? ""}>
                <option value="">— Não atribuída —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.status !== "active"}>
                    {a.name} · {a.title}
                    {a.status !== "active" ? " (inativo)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Máximo de tentativas" name="maxAttempts">
              <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={3} />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="dispatch" defaultChecked className="accent-[#3d7bff]" />
              Enviar imediatamente para a fila (requer responsável ativo)
            </label>
          </CardContent>
        </Card>
        <div className="space-y-6">
        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="size-4" /> Execução por IA
              </CardTitle>
              <CardDescription>{TASK_TYPES["agent.execute"].description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requireApproval" className="accent-[#3d7bff]" />
              Exigir minha aprovação do resultado
            </label>
            <SubmitButton className="w-full">Criar tarefa</SubmitButton>
          </CardContent>
        </Card>
        <Card className="h-fit border-violet/30">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2 text-violet">
                <FlaskConical className="size-4" /> Somente para o tipo demonstração
              </CardTitle>
              <CardDescription>{TASK_TYPES["demo.lifecycle"].description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Etapas simuladas" name="steps">
              <Input id="steps" name="steps" type="number" min={1} max={10} defaultValue={3} />
            </Field>
            <Field label="Falhas forçadas antes de concluir" name="failTimes" hint="Testa as novas tentativas automáticas.">
              <Input id="failTimes" name="failTimes" type="number" min={0} max={5} defaultValue={0} />
            </Field>
          </CardContent>
        </Card>
        </div>
      </ActionForm>
    </>
  );
}
