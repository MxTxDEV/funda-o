import { assertCan, listAgents, listDepartments } from "@vc/core";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getServiceContext } from "@/lib/session";
import { createAgentAction } from "../../actions/agents";
import { ToolPicker } from "../tool-picker";

export const metadata = { title: "Novo funcionário" };

export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  const { departmentId } = await searchParams;
  const ctx = await getServiceContext();
  assertCan(ctx.actor, "agents:write");
  const [departments, colleagues] = await Promise.all([listDepartments(ctx, { activeOnly: true }), listAgents(ctx)]);
  const managers = colleagues.filter((c) => c.hierarchyLevel !== "specialist");

  if (departments.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Equipe" title="Novo funcionário" />
        <EmptyState
          title="Crie um departamento ativo primeiro"
          action={
            <Button asChild>
              <Link href="/departments">Ir para departamentos</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Equipe" title="Novo funcionário virtual" description="As instruções e ferramentas formam a versão 1. Alterações futuras criam novas versões." />
      <ActionForm action={createAgentAction} className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Nome" name="name">
              <Input id="name" name="name" required minLength={2} maxLength={80} />
            </Field>
            <Field label="Cargo" name="title">
              <Input id="title" name="title" required minLength={2} maxLength={80} placeholder="Ex.: Copywriter Sênior" />
            </Field>
            <Field label="Departamento" name="departmentId">
              <Select id="departmentId" name="departmentId" defaultValue={departmentId} required>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status inicial" name="status">
              <Select id="status" name="status" defaultValue="active">
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
              </Select>
            </Field>
            <Field label="Especialidade" name="specialty" className="md:col-span-2">
              <Input id="specialty" name="specialty" required minLength={2} maxLength={120} placeholder="Ex.: Copy de resposta direta para infoprodutos" />
            </Field>
            <Field label="Descrição" name="description" className="md:col-span-2">
              <Textarea id="description" name="description" maxLength={2000} />
            </Field>
            <Field label="Especialidades (uma por linha)" name="specialties">
              <Textarea id="specialties" name="specialties" />
            </Field>
            <Field label="Responsabilidades (uma por linha)" name="responsibilities">
              <Textarea id="responsibilities" name="responsibilities" />
            </Field>
            <Field label="Personalidade profissional" name="personality" className="md:col-span-2">
              <Input id="personality" name="personality" maxLength={500} placeholder="Ex.: analítico, organizado e orientado a resultados" />
            </Field>
            <Field label="Nível hierárquico" name="hierarchyLevel">
              <Select id="hierarchyLevel" name="hierarchyLevel" defaultValue="specialist">
                <option value="specialist">Especialista</option>
                <option value="director">Diretor de departamento</option>
                <option value="coo">Diretor de Operações (COO)</option>
              </Select>
            </Field>
            <Field label="Reporta a" name="reportsToAgentId">
              <Select id="reportsToAgentId" name="reportsToAgentId" defaultValue="">
                <option value="">Proprietário</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Avatar (URL https, opcional)" name="avatarUrl" className="md:col-span-2" hint="Sem URL, um personagem estilizado é gerado automaticamente.">
              <Input id="avatarUrl" name="avatarUrl" type="url" placeholder="https://..." maxLength={500} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Versão 1 — instruções e ferramentas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Instruções" name="instructions" hint="Serão usadas pelo Central Brain quando integrado.">
              <Textarea id="instructions" name="instructions" required minLength={10} maxLength={20000} className="min-h-40 font-mono text-xs" />
            </Field>
            <Field label="Ferramentas autorizadas" name="allowedTools">
              <ToolPicker />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Provedor de IA (opcional)" name="aiProvider" hint="Nenhuma integração de IA está ativa nesta fase.">
                <Input id="aiProvider" name="aiProvider" maxLength={80} />
              </Field>
              <Field label="Modelo de IA (opcional)" name="aiModel">
                <Input id="aiModel" name="aiModel" maxLength={80} />
              </Field>
            </div>
            <input type="hidden" name="changeNote" value="Versão inicial" />
            <SubmitButton className="w-full">Cadastrar funcionário</SubmitButton>
          </CardContent>
        </Card>
      </ActionForm>
    </>
  );
}
