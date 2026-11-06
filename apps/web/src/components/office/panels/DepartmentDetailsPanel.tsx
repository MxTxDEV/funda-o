"use client";
import { DEPARTMENT_ZONES, getDepartmentZone, OFFICE_STATUS_COLORS, OFFICE_STATUS_LABELS } from "@vc/core/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { setDepartmentZoneAction } from "@/app/(app)/actions/office";
import { FormMessage, SubmitButton } from "@/components/forms";
import { DemoBadge, TaskStatusBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useOfficeStore } from "../store";
import type { OfficeDepartment, OfficeSnapshot } from "../types";
import { PanelShell, Section, Stat } from "./PanelShell";

function ZoneForm({
  departmentId,
  zone,
  departments,
  onSaved,
  mode,
}: {
  departmentId?: string;
  zone?: string | null;
  departments?: OfficeDepartment[];
  onSaved: () => void;
  mode: "move" | "assign";
}) {
  const [state, action] = useActionState(setDepartmentZoneAction, null);
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);
  return (
    <form action={action} className="space-y-2">
      {mode === "move" ? (
        <>
          <input type="hidden" name="departmentId" value={departmentId} />
          <Select name="zone" defaultValue={zone ?? ""} aria-label="Sala do departamento">
            {DEPARTMENT_ZONES.map((z) => (
              <option key={z.key} value={z.key}>
                {z.label}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <>
          <input type="hidden" name="zone" value={zone ?? ""} />
          <Select name="departmentId" defaultValue="" required aria-label="Departamento para esta sala">
            <option value="" disabled>
              Selecione um departamento…
            </option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.zone ? ` (hoje em ${getDepartmentZone(d.zone)?.label})` : " (sem sala)"}
              </option>
            ))}
          </Select>
        </>
      )}
      <SubmitButton size="sm" variant="secondary" className="w-full">
        {mode === "move" ? "Mover para esta sala" : "Vincular à sala"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function DepartmentDetailsPanel({
  department,
  zoneKey,
  snapshot,
  onClose,
  onChanged,
}: {
  department: OfficeDepartment | null;
  zoneKey: string | null;
  snapshot: OfficeSnapshot;
  onClose: () => void;
  onChanged: () => void;
}) {
  const select = useOfficeStore((s) => s.select);
  const zone = getDepartmentZone(department?.zone ?? zoneKey ?? "");

  if (!department) {
    return (
      <PanelShell eyebrow="Sala" title={zone?.label ?? "Sala"} onClose={onClose}>
        <p className="text-muted-foreground">Nenhum departamento ocupa esta sala.</p>
        {zone && (
          <Section title="Responsabilidades previstas">
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {zone.responsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Section>
        )}
        {snapshot.permissions.manageDepartments && snapshot.departments.length > 0 ? (
          <Section title="Vincular departamento">
            <ZoneForm mode="assign" zone={zoneKey} departments={snapshot.departments} onSaved={onChanged} />
          </Section>
        ) : (
          <Button asChild variant="secondary" className="w-full">
            <Link href="/departments">Gerenciar departamentos</Link>
          </Button>
        )}
      </PanelShell>
    );
  }

  const members = snapshot.agents.filter((a) => a.departmentId === department.id);
  const available = members.filter((a) => a.officeStatus === "available");

  return (
    <PanelShell eyebrow={zone ? `Sala · ${zone.label}` : "Departamento sem sala"} title={department.name} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-3 rounded-sm" style={{ background: department.color }} />
        {department.isActive ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}
        {department.isDemo && <DemoBadge />}
        {department.zoneSource === "auto" && <Badge tone="neutral">sala definida automaticamente</Badge>}
      </div>
      {department.description && <p className="text-muted-foreground">{department.description}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Funcionários" value={department.agentCount} />
        <Stat label="Tarefas ativas" value={department.activeTaskCount} />
        <Stat label="Disponíveis" value={department.availableCount} />
      </div>

      <Section title="Tarefas ativas">
        {department.activeTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa ativa.</p>
        ) : (
          <ul className="space-y-1.5">
            {department.activeTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-primary/50">
                  <span className="truncate">{t.title}</span>
                  <TaskStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Equipe (${members.length}) · ${available.length} disponível(is)`}>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum funcionário neste departamento.</p>
        ) : (
          <ul className="space-y-1">
            {members.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => select({ kind: "agent", id: a.id })} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-surface-2">
                  <span className="truncate">
                    {a.name} <span className="text-muted-foreground">· {a.title}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1" style={{ color: OFFICE_STATUS_COLORS[a.officeStatus] }}>
                    <span className="size-1.5 rounded-full" style={{ background: OFFICE_STATUS_COLORS[a.officeStatus] }} />
                    {OFFICE_STATUS_LABELS[a.officeStatus]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {zone && (
        <Section title="Responsabilidades da sala">
          <p className="text-xs text-muted-foreground">{zone.responsibilities.join(" · ")}</p>
        </Section>
      )}

      {snapshot.permissions.manageDepartments && (
        <Section title="Posição no escritório">
          <ZoneForm mode="move" departmentId={department.id} zone={department.zone} onSaved={onChanged} />
        </Section>
      )}

      <Button asChild variant="secondary" className="w-full">
        <Link href={`/departments/${department.id}`}>
          <ExternalLink /> Abrir página do departamento
        </Link>
      </Button>
    </PanelShell>
  );
}
