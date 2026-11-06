"use client";
import { OFFICE_STATUS_COLORS, OFFICE_STATUS_LABELS, OFFICE_STATUSES } from "@vc/core/client";
import { AgentAvatar } from "@/components/agent-avatar";
import { cn } from "@/lib/utils";
import { useOfficeStore } from "./store";
import type { OfficeAgent } from "./types";

/** Bottom bar: every employee with its live status (also an accessible way to select them). */
export function OfficeStatusBar({ agents }: { agents: OfficeAgent[] }) {
  const selection = useOfficeStore((s) => s.selection);
  const select = useOfficeStore((s) => s.select);
  return (
    <div className="flex flex-col gap-2 border-t border-border bg-surface/90 px-3 py-2 backdrop-blur md:flex-row md:items-center">
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1">
        {OFFICE_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title={s === "communicating" ? "Disponível após a integração do Central Brain" : undefined}>
            <span className="size-2 rounded-full" style={{ background: OFFICE_STATUS_COLORS[s], opacity: s === "communicating" ? 0.4 : 1 }} />
            {OFFICE_STATUS_LABELS[s]}
            {s === "communicating" && <span className="text-[10px] opacity-60">(futuro)</span>}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5" aria-label="Funcionários">
        {agents.length === 0 && <span className="text-xs text-muted-foreground">Nenhum funcionário cadastrado.</span>}
        {agents.map((a) => {
          const active = selection?.kind === "agent" && selection.id === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => select({ kind: "agent", id: a.id })}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors",
                active ? "border-primary bg-primary/15" : "border-border bg-surface-2/70 hover:border-border-strong",
              )}
              aria-pressed={active}
              data-testid={`office-agent-${a.id}`}
            >
              <AgentAvatar seed={a.avatarSeed} url={a.avatarUrl} name={a.name} size={22} />
              <span className="font-medium">{a.name}</span>
              <span className="size-1.5 rounded-full" style={{ background: OFFICE_STATUS_COLORS[a.officeStatus] }} title={OFFICE_STATUS_LABELS[a.officeStatus]} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
