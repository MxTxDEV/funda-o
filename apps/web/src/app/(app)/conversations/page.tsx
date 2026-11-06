import { can, CONVERSATION_KIND_LABELS, listAgents, listConversations, listDepartments } from "@vc/core";
import { Hash, MessagesSquare, User, Users } from "lucide-react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { getServiceContext } from "@/lib/session";
import { formatRelative } from "@/lib/utils";
import { createConversationAction } from "../actions/conversations";

export const metadata = { title: "Conversas" };

const KIND_ICON = { direct: User, department: Users, general: Hash } as const;

export default async function ConversationsPage() {
  const ctx = await getServiceContext();
  const [conversations, agents, departments] = await Promise.all([listConversations(ctx), listAgents(ctx), listDepartments(ctx)]);
  const canWrite = can(ctx.actor, "conversations:write");

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        title="Conversas"
        description="Canais individuais, por departamento e geral. Os funcionários passarão a responder quando o Central Brain for integrado."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="p-0">
            {conversations.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<MessagesSquare />} title="Nenhuma conversa" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => {
                  const Icon = KIND_ICON[c.kind];
                  return (
                    <li key={c.id}>
                      <Link href={`/conversations/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                        <span className="grid size-8 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.lastMessageAt ? `Última mensagem ${formatRelative(c.lastMessageAt)}` : "Sem mensagens"}
                          </span>
                        </span>
                        <Badge>{CONVERSATION_KIND_LABELS[c.kind]}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        {canWrite && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Nova conversa</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={createConversationAction} className="space-y-4">
                <Field label="Tipo" name="kind">
                  <Select id="kind" name="kind" defaultValue="direct">
                    <option value="direct">Individual (com um funcionário)</option>
                    <option value="department">Departamento</option>
                    <option value="general">Geral</option>
                  </Select>
                </Field>
                <Field label="Funcionário (individual)" name="agentId">
                  <Select id="agentId" name="agentId" defaultValue="">
                    <option value="">—</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Departamento" name="departmentId">
                  <Select id="departmentId" name="departmentId" defaultValue="">
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Título (opcional)" name="title">
                  <Input id="title" name="title" maxLength={120} />
                </Field>
                <SubmitButton className="w-full">Criar conversa</SubmitButton>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
