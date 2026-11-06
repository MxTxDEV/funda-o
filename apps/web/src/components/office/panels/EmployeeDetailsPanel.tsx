"use client";
import { getTool, OFFICE_STATUS_COLORS, OFFICE_STATUS_LABELS, TASK_EVENT_LABELS } from "@vc/core/client";
import { ExternalLink, ListPlus, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { openDirectConversationAction } from "@/app/(app)/actions/office";
import { AgentAvatar } from "@/components/agent-avatar";
import { SubmitButton } from "@/components/forms";
import { DemoBadge, TaskStatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import type { OfficeAgent, OfficeDepartment, OfficeSnapshot } from "../types";
import { FutureNote, PanelShell, Section } from "./PanelShell";

export function EmployeeDetailsPanel({
  agent,
  department,
  permissions,
  onClose,
}: {
  agent: OfficeAgent;
  department: OfficeDepartment | undefined;
  permissions: OfficeSnapshot["permissions"];
  onClose: () => void;
}) {
  const color = OFFICE_STATUS_COLORS[agent.officeStatus];
  return (
    <PanelShell eyebrow="Funcionário" title={agent.name} onClose={onClose}>
      <div className="flex items-center gap-3">
        <AgentAvatar seed={agent.avatarSeed} url={agent.avatarUrl} name={agent.name} size={56} />
        <div className="min-w-0">
          <p className="truncate font-medium">{agent.title}</p>
          <p className="truncate text-xs" style={{ color: department?.color }}>
            {department?.name ?? "—"}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs" style={{ color }} data-testid="office-agent-status">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {OFFICE_STATUS_LABELS[agent.officeStatus]}
          </p>
        </div>
        {agent.isDemo && <DemoBadge className="ml-auto" />}
      </div>

      <Section title="Especialidade">
        <p>{agent.specialty}</p>
        {agent.description && <p className="mt-1 text-xs text-muted-foreground">{agent.description}</p>}
      </Section>

      <Section title="Tarefa atual">
        {agent.currentTask ? (
          <Link href={`/tasks/${agent.currentTask.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 hover:border-primary/50">
            <span className="truncate">{agent.currentTask.title}</span>
            <TaskStatusBadge status={agent.currentTask.status} />
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa em andamento.</p>
        )}
        {agent.activeTaskCount > 1 && <p className="mt-1 text-xs text-muted-foreground">{agent.activeTaskCount} tarefas ativas no total.</p>}
      </Section>

      <Section title="Últimas atividades">
        {agent.recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem atividades registradas.</p>
        ) : (
          <ul className="space-y-1.5">
            {agent.recentEvents.map((e) => (
              <li key={e.id} className="text-xs">
                <span className="text-[#9dbbff]">{TASK_EVENT_LABELS[e.type] ?? e.type}</span>{" "}
                <Link href={`/tasks/${e.taskId}`} className="hover:underline">
                  {e.taskTitle}
                </Link>
                <span className="block text-[11px] text-muted-foreground">{formatRelative(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Ferramentas autorizadas${agent.version ? ` · v${agent.version}` : ""}`}>
        <div className="flex flex-wrap gap-1.5">
          {agent.allowedTools.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma.</span>}
          {agent.allowedTools.map((t) => (
            <Badge key={t} tone="blue">
              {getTool(t)?.label ?? t}
            </Badge>
          ))}
        </div>
      </Section>

      <FutureNote>Execução por IA e respostas na conversa dependem da integração do Central Brain (fase futura).</FutureNote>

      <div className="grid gap-2">
        {permissions.writeConversations ? (
          <form action={openDirectConversationAction}>
            <input type="hidden" name="agentId" value={agent.id} />
            <SubmitButton className="w-full" pendingText="Abrindo conversa…">
              <MessagesSquare /> Abrir conversa
            </SubmitButton>
          </form>
        ) : agent.directConversationId ? (
          <Button asChild>
            <Link href={`/conversations/${agent.directConversationId}`}>
              <MessagesSquare /> Ver conversa
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href={`/agents/${agent.id}`}>
            <ExternalLink /> Ver perfil
          </Link>
        </Button>
        {permissions.writeTasks && agent.status === "active" && (
          <Button asChild variant="outline">
            <Link href={`/tasks/new?agentId=${agent.id}`}>
              <ListPlus /> Nova tarefa para {agent.name.split(" ")[0]}
            </Link>
          </Button>
        )}
      </div>
    </PanelShell>
  );
}
