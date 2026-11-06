import { AI_CONNECTION_LABELS, aiConnectionOf, can, HIERARCHY_LABELS, initialTeamStatus, listAgents } from "@vc/core";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";
import { EmptyState, PageHeader } from "@/components/page-header";
import { AgentStatusBadge, DemoBadge, PresenceBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServiceContext } from "@/lib/session";
import { OrgChart } from "./org-chart";
import { InitialTeamCard } from "./team-panel";

export const metadata = { title: "Funcionários" };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  const ctx = await getServiceContext();
  const agents = await listAgents(ctx, { includeArchived: archived === "1" });
  const canWrite = can(ctx.actor, "agents:write");
  const canSeed = canWrite && can(ctx.actor, "departments:write");
  const team = canSeed ? await initialTeamStatus(ctx) : null;
  const visible = agents.filter((a) => a.status !== "archived");

  return (
    <>
      <PageHeader
        eyebrow="Equipe"
        title="Funcionários virtuais"
        description="Perfis, instruções versionadas e ferramentas autorizadas de cada funcionário."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={archived === "1" ? "/agents" : "/agents?archived=1"}>{archived === "1" ? "Ocultar arquivados" : "Mostrar arquivados"}</Link>
            </Button>
            {canWrite && (
              <Button asChild>
                <Link href="/agents/new">
                  <Plus /> Novo funcionário
                </Link>
              </Button>
            )}
          </>
        }
      />
      {team && team.registered < team.total && <InitialTeamCard registered={team.registered} total={team.total} />}
      <OrgChart agents={visible} ownerName={ctx.actor.name} />
      {agents.length === 0 ? (
        <EmptyState icon={<Users />} title="Nenhum funcionário cadastrado" description="Cadastre funcionários especializados em marketing digital." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`} className="group">
              <Card className="h-full p-4 transition-colors group-hover:border-primary/50">
                <div className="flex items-start gap-3">
                  <AgentAvatar seed={a.avatarSeed} url={a.avatarUrl} appearance={a.appearance} name={a.name} size={52} presence={a.presence?.state} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.title}</p>
                    <p className="mt-1 truncate text-xs" style={{ color: a.department.color }}>
                      {a.department.name}
                    </p>
                  </div>
                  {a.isDemo && <DemoBadge />}
                </div>
                <p className="mt-3 line-clamp-2 min-h-8 text-xs text-muted-foreground">{a.specialty}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={a.hierarchyLevel === "specialist" ? "neutral" : "blue"}>{HIERARCHY_LABELS[a.hierarchyLevel]}</Badge>
                  <Badge tone="neutral" title={AI_CONNECTION_LABELS[aiConnectionOf(a.currentVersion?.aiProvider, a.currentVersion?.aiModel)]}>
                    IA: {a.currentVersion?.aiModel ? "configurada (não conectada)" : "não configurada"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <AgentStatusBadge status={a.status} />
                  {a.presence && <PresenceBadge state={a.presence.state} />}
                  <span className="text-[11px] text-muted-foreground">v{a.currentVersion?.version ?? "—"}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
