"use client";
import { Building2, Loader2, MonitorX, UserPlus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OfficeFloor } from "@/components/office-floor";
import { OfficeControls } from "./OfficeControls";
import { OfficeStatusBar } from "./OfficeStatusBar";
import { OfficeTopBar } from "./OfficeTopBar";
import { DepartmentDetailsPanel } from "./panels/DepartmentDetailsPanel";
import { EmployeeDetailsPanel } from "./panels/EmployeeDetailsPanel";
import { RoomPanel } from "./panels/RoomPanels";
import { useOfficeStore } from "./store";
import type { OfficeSnapshot } from "./types";
import { detectWebGL, useOfficeData } from "./use-office-data";

// The 3D engine (three.js + R3F) is loaded only on this page, on the client.
const VirtualOfficeCanvas = dynamic(() => import("./scene/VirtualOfficeCanvas"), {
  ssr: false,
  loading: () => <CanvasLoading />,
});

function CanvasLoading() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Carregando escritório 3D…
      </span>
    </div>
  );
}

export function VirtualOffice({ initial }: { initial: OfficeSnapshot }) {
  const { snapshot, error, refresh } = useOfficeData(initial);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const selection = useOfficeStore((s) => s.selection);
  const select = useOfficeStore((s) => s.select);

  useEffect(() => setWebgl(detectWebGL()), []);
  useEffect(() => () => select(null), [select]);

  const close = () => select(null);
  const empty = snapshot.agents.length === 0;

  let panel: React.ReactNode = null;
  if (selection?.kind === "agent") {
    const agent = snapshot.agents.find((a) => a.id === selection.id);
    if (agent)
      panel = (
        <EmployeeDetailsPanel
          agent={agent}
          department={snapshot.departments.find((d) => d.id === agent.departmentId)}
          permissions={snapshot.permissions}
          onClose={close}
        />
      );
  } else if (selection?.kind === "department" || selection?.kind === "zone") {
    const dept = selection.kind === "department" ? (snapshot.departments.find((d) => d.id === selection.id) ?? null) : null;
    panel = (
      <DepartmentDetailsPanel
        department={dept}
        zoneKey={selection.kind === "zone" ? selection.id : null}
        snapshot={snapshot}
        onClose={close}
        onChanged={() => void refresh()}
      />
    );
  } else if (selection?.kind === "room") {
    panel = <RoomPanel room={selection.id} snapshot={snapshot} onClose={close} />;
  }

  const unplaced = snapshot.departments.filter((d) => snapshot.unplacedDepartmentIds.includes(d.id));

  return (
    <div className="relative flex h-[calc(100dvh-150px)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-[#07090d]">
      <div className="relative flex-1" data-testid="office-viewport">
        {webgl === null ? (
          <CanvasLoading />
        ) : webgl ? (
          <VirtualOfficeCanvas snapshot={snapshot} />
        ) : (
          <div className="h-full overflow-y-auto p-4 pt-14">
            <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <MonitorX className="size-4" /> Seu navegador não suporta WebGL. Exibindo a planta 2D do escritório.
            </div>
            {snapshot.agents.length > 0 && (
              <OfficeFloor
                agents={snapshot.agents.map((a) => {
                  const d = snapshot.departments.find((x) => x.id === a.departmentId)!;
                  return {
                    id: a.id,
                    name: a.name,
                    title: a.title,
                    avatarSeed: a.avatarSeed,
                    avatarUrl: a.avatarUrl,
                    isDemo: a.isDemo,
                    department: { id: d.id, name: d.name, color: d.color, isActive: d.isActive },
                    presence: { state: a.presence, statusMessage: a.statusMessage },
                  };
                })}
              />
            )}
          </div>
        )}

        {/* indicators overlay */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col gap-2">
          <OfficeTopBar metrics={snapshot.metrics} />
          {error && <div className="pointer-events-auto w-fit rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-[#ff9b9b]">{error}</div>}
          {unplaced.length > 0 && (
            <details className="pointer-events-auto w-fit max-w-md rounded-md border border-warning/30 bg-[#0b0f16]/90 px-3 py-1.5 text-xs text-warning">
              <summary className="cursor-pointer select-none">{unplaced.length} departamento(s) sem sala no escritório</summary>
              <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                {unplaced.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => select({ kind: "department", id: d.id })}>
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {empty && (
            <div
              className="pointer-events-auto flex w-fit flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-[#0b0f16]/90 px-3 py-2 text-xs shadow-lg backdrop-blur"
              data-testid="office-empty"
              role="status"
            >
              <Building2 className="size-4 text-primary" />
              <span className="text-slate-300">Nenhum funcionário cadastrado ainda.</span>
              <Link href="/departments" className="rounded border border-border px-2 py-0.5 hover:border-primary/60">
                Departamentos
              </Link>
              <Link href="/agents" className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-white hover:bg-primary-hover">
                <UserPlus className="size-3.5" /> Cadastrar funcionários
              </Link>
            </div>
          )}
        </div>

        {webgl && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-30">
            <OfficeControls snapshot={snapshot} />
          </div>
        )}

        {panel}
      </div>
      <OfficeStatusBar agents={snapshot.agents} />
    </div>
  );
}
