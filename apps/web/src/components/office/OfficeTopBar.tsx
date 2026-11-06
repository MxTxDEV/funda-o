"use client";
import { Building2, CheckCheck, ListTodo, Users, UserCheck, Zap } from "lucide-react";
import type { OfficeSnapshot } from "./types";

/** Live indicators computed from the database snapshot (no static numbers). */
export function OfficeTopBar({ metrics }: { metrics: OfficeSnapshot["metrics"] }) {
  const items = [
    { label: "Funcionários", value: metrics.agents, icon: Users },
    { label: "Trabalhando", value: metrics.working, icon: Zap },
    { label: "Disponíveis", value: metrics.available, icon: UserCheck },
    { label: "Tarefas ativas", value: metrics.activeTasks, icon: ListTodo },
    { label: "Aguardando aprovação", value: metrics.pendingApprovals, icon: CheckCheck },
    { label: "Departamentos", value: metrics.departments, icon: Building2 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="list" aria-label="Indicadores do escritório">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} role="listitem" className="flex items-center gap-3 rounded-md border border-border bg-surface/80 px-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold leading-tight tabular-nums" data-metric={label}>
              {value}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
