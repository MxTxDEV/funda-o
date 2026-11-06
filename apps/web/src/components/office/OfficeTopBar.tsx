"use client";
import { Building2, CheckCheck, ListTodo, UserCheck, Users, Zap } from "lucide-react";
import type { OfficeSnapshot } from "./types";

/** Compact live indicators (computed from the database snapshot), overlaid on the scene. */
export function OfficeTopBar({ metrics }: { metrics: OfficeSnapshot["metrics"] }) {
  const items = [
    { label: "Funcionários", value: metrics.agents, icon: Users },
    { label: "Trabalhando", value: metrics.working, icon: Zap, title: "Executando uma tarefa agora" },
    { label: "Disponíveis", value: metrics.available, icon: UserCheck },
    { label: "Tarefas ativas", value: metrics.activeTasks, icon: ListTodo },
    { label: "Aguardando aprovação", value: metrics.pendingApprovals, icon: CheckCheck },
    { label: "Departamentos", value: metrics.departments, icon: Building2 },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Indicadores do escritório">
      {items.map(({ label, value, icon: Icon, title }) => (
        <div
          key={label}
          role="listitem"
          title={title}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#0b0f16]/80 py-1 pl-2 pr-3 text-xs shadow-lg backdrop-blur"
        >
          <Icon className="size-3.5 text-[#7aa2ff]" />
          <span className="font-semibold tabular-nums text-white" data-metric={label}>
            {value}
          </span>
          <span className="text-[11px] text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
