import { can, getApproval } from "@vc/core";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/page-header";
import { ApprovalStatusBadge, DemoBadge, TaskStatusBadge } from "@/components/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { handlePageError } from "@/lib/page-errors";
import { getServiceContext } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { decideApprovalAction } from "../../actions/approvals";

const ACTION_LABELS: Record<string, string> = {
  "approval.request": "Solicitada",
  "approval.approve": "Aprovada",
  "approval.reject": "Rejeitada",
};

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getServiceContext();
  const approval = await getApproval(ctx, id).catch(handlePageError);
  const canDecide = can(ctx.actor, "approvals:decide") && approval.status === "pending";

  return (
    <>
      <PageHeader
        eyebrow="Aprovação"
        title={approval.title}
        description={approval.summary || undefined}
        actions={
          <>
            {approval.task?.isDemo && <DemoBadge />}
            <ApprovalStatusBadge status={approval.status} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo para revisão</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-xs">
                {JSON.stringify(approval.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {canDecide && (
            <Card className="border-warning/30">
              <CardHeader>
                <CardTitle>Decisão</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionForm action={decideApprovalAction} className="space-y-4">
                  <input type="hidden" name="id" value={approval.id} />
                  <input type="hidden" name="expectedVersion" value={approval.version} />
                  <Field label="Observação (opcional)" name="note">
                    <Textarea id="note" name="note" maxLength={1000} placeholder="Justificativa ou orientações" />
                  </Field>
                  <div className="flex gap-3">
                    <SubmitButton name="decision" value="approve" variant="success">
                      <Check /> Aprovar
                    </SubmitButton>
                    <SubmitButton name="decision" value="reject" variant="destructive">
                      <X /> Rejeitar
                    </SubmitButton>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contexto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {approval.task && (
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/tasks/${approval.task.id}`} className="truncate hover:underline">
                    {approval.task.title}
                  </Link>
                  <TaskStatusBadge status={approval.task.status} />
                </div>
              )}
              {approval.agent && (
                <p className="text-muted-foreground">
                  Funcionário:{" "}
                  <Link className="text-foreground hover:underline" href={`/agents/${approval.agent.id}`}>
                    {approval.agent.name}
                  </Link>
                </p>
              )}
              <p className="text-muted-foreground">Tipo: {approval.kind}</p>
              {approval.decisionNote && <p className="rounded-md bg-surface-2 p-2">“{approval.decisionNote}”</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {approval.history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)} · {h.actorLabel}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
