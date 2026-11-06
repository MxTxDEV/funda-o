import { can, listDepartments } from "@vc/core";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/page-header";
import { DemoBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServiceContext } from "@/lib/session";
import { createDepartmentAction } from "../actions/departments";

export const metadata = { title: "Departamentos" };

export default async function DepartmentsPage() {
  const ctx = await getServiceContext();
  const departments = await listDepartments(ctx);
  const canWrite = can(ctx.actor, "departments:write");

  return (
    <>
      <PageHeader eyebrow="Estrutura" title="Departamentos" description="Organize os funcionários virtuais em áreas de atuação." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="p-0">
            {departments.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<Building2 />} title="Nenhum departamento" description="Crie o primeiro departamento ao lado." />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Departamento</TH>
                    <TH>Funcionários</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {departments.map((d) => (
                    <TR key={d.id}>
                      <TD>
                        <Link href={`/departments/${d.id}`} className="flex items-center gap-3 font-medium hover:underline">
                          <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
                          {d.name}
                          {d.isDemo && <DemoBadge />}
                        </Link>
                        {d.description && <p className="ml-5.5 mt-0.5 line-clamp-1 text-xs text-muted-foreground">{d.description}</p>}
                      </TD>
                      <TD className="tabular-nums">{d.agentCount}</TD>
                      <TD>{d.isActive ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {canWrite && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Novo departamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createDepartmentAction} className="space-y-4">
                <Field label="Nome" name="name">
                  <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Ex.: Pesquisa de Mercado" />
                </Field>
                <Field label="Descrição" name="description">
                  <Textarea id="description" name="description" maxLength={500} placeholder="Responsabilidades do departamento" />
                </Field>
                <Field label="Cor da sala" name="color" hint="Usada no escritório e nos destaques.">
                  <Input id="color" name="color" type="color" defaultValue="#3d7bff" className="h-9 w-20 p-1" />
                </Field>
                <SubmitButton className="w-full">Criar departamento</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
