import { HIERARCHY_LABELS } from "@vc/core";
import type { AgentAppearance, AgentHierarchyLevel } from "@vc/db";
import { Crown } from "lucide-react";
import Link from "next/link";
import { AgentAvatar } from "@/components/agent-avatar";

type Node = {
  id: string;
  name: string;
  title: string;
  avatarSeed: string;
  avatarUrl: string | null;
  appearance: AgentAppearance;
  hierarchyLevel: AgentHierarchyLevel;
  reportsToAgentId: string | null;
  department: { name: string; color: string };
};

function Person({ n, compact = false }: { n: Node; compact?: boolean }) {
  return (
    <Link
      href={`/agents/${n.id}`}
      className="flex items-center gap-2 rounded-md border border-border bg-surface-2/70 px-2.5 py-2 text-left transition-colors hover:border-primary/50"
      title={HIERARCHY_LABELS[n.hierarchyLevel]}
    >
      <AgentAvatar seed={n.avatarSeed} url={n.avatarUrl} appearance={n.appearance} name={n.name} size={compact ? 26 : 34} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{n.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{n.title}</span>
      </span>
    </Link>
  );
}

/** Owner → COO → directors → specialists, built from the real reporting lines. */
export function OrgChart({ agents, ownerName }: { agents: Node[]; ownerName: string }) {
  const coos = agents.filter((a) => a.hierarchyLevel === "coo");
  const directors = agents.filter((a) => a.hierarchyLevel === "director");
  const reportsOf = (id: string) => agents.filter((a) => a.reportsToAgentId === id && a.hierarchyLevel === "specialist");
  const orphans = agents.filter(
    (a) => a.hierarchyLevel === "specialist" && (!a.reportsToAgentId || !directors.some((d) => d.id === a.reportsToAgentId)),
  );
  if (agents.length === 0) return null;
  return (
    <section className="mb-8 rounded-lg border border-border bg-surface/60 p-4" aria-label="Organograma">
      <h2 className="mb-3 text-sm font-semibold">Organograma</h2>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-[#c9a227]/50 bg-[#c9a227]/10 px-3 py-2 text-sm">
          <Crown className="size-4 text-[#e0bb3a]" /> <span className="font-medium">{ownerName}</span>
          <span className="text-xs text-muted-foreground">Proprietário · autoridade máxima</span>
        </div>
        <span className="h-3 w-px bg-border-strong" />
        <div className="flex flex-wrap justify-center gap-2">
          {coos.length ? coos.map((c) => <Person key={c.id} n={c} />) : <span className="text-xs text-muted-foreground">Sem diretor de operações</span>}
        </div>
        <span className="h-3 w-px bg-border-strong" />
        <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-5">
          {directors.map((d) => (
            <div key={d.id} className="rounded-md border border-border/70 p-2" style={{ borderTopColor: d.department.color, borderTopWidth: 2 }}>
              <p className="mb-1.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground">{d.department.name}</p>
              <Person n={d} />
              <div className="mt-2 space-y-1.5 border-l border-border-strong pl-2">
                {reportsOf(d.id).map((s) => (
                  <Person key={s.id} n={s} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
        {orphans.length > 0 && (
          <div className="w-full">
            <p className="mb-1.5 text-[11px] text-muted-foreground">Especialistas sem diretor definido</p>
            <div className="flex flex-wrap gap-2">
              {orphans.map((s) => (
                <Person key={s.id} n={s} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
