import { APPROVAL_STATUS_LABELS, APPROVAL_STATUSES, listApprovals } from "@vc/core";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ApprovalStatusBadge, DemoBadge } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServiceContext } from "@/lib/session";
import { cn, formatRelative } from "@/lib/utils";

export const metadata = { title: "Aprovações" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === "all" ? undefined : (APPROVAL_STATUSES.find((s) => s === sp.status) ?? "pending");
  const ctx = await getServiceContext();
  const { items } = await listApprovals(ctx, { status, limit: 100 });

  return (
    <>
      <AutoRefresh intervalMs={7000} />
      <PageHeader eyebrow="Governança" title="Aprovações" description="Toda entrega sensível passa por uma decisão humana registrada e auditada." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[...APPROVAL_STATUSES, "all" as const].map((s) => (
          <Link
            key={s}
            href={`/approvals?status=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              (status ?? "all") === s ? "border-primary/60 bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "all" ? "Todas" : APPROVAL_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<CheckCheck />} title="Nenhuma aprovação nesta lista" />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Solicitação</TH>
                  <TH>Funcionário</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Criada</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <Link href={`/approvals/${a.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        {a.title}
                        {a.task?.isDemo && <DemoBadge />}
                      </Link>
                      {a.task && <span className="text-xs text-muted-foreground">Tarefa: {a.task.title}</span>}
                    </TD>
                    <TD>
                      {a.agent ? (
                        <span className="flex items-center gap-2 text-sm">
                          <AgentAvatar seed={a.agent.avatarSeed} url={a.agent.avatarUrl} name={a.agent.name} size={24} />
                          {a.agent.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      <ApprovalStatusBadge status={a.status} />
                    </TD>
                    <TD className="text-right text-xs text-muted-foreground">{formatRelative(a.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
