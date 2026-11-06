"use client";
import { OFFICE_STATUS_COLORS } from "@vc/core/client";
import { Html } from "@react-three/drei";
import type { DepartmentRoom, OfficeLayout } from "../layout";
import { useOfficeStore } from "../store";
import type { OfficeAgent } from "../types";
import { EmployeeCharacter } from "./EmployeeCharacter";
import { EmployeeStation } from "./EmployeeStation";
import { RoomShell } from "./RoomShell";

/** A department room: glass shell + workstations + the real employees seated at their desks. */
export function DepartmentArea({ room, layout, agentsById }: { room: DepartmentRoom; layout: OfficeLayout; agentsById: Map<string, OfficeAgent> }) {
  const dept = room.department;
  const selection = useOfficeStore((s) => s.selection);
  const select = useOfficeStore((s) => s.select);
  const selected =
    (selection?.kind === "department" && dept?.id === selection.id) || (selection?.kind === "zone" && selection.id === room.zone);
  const color = dept?.color ?? "#3a4558";
  const working = dept ? dept.agentCount - dept.availableCount : 0;

  return (
    <RoomShell
      center={room.center}
      color={color}
      title={dept ? dept.name : room.zoneLabel}
      subtitle={dept ? `${dept.agentCount} funcionário(s) · ${dept.activeTaskCount} tarefa(s) ativa(s)` : "sala sem departamento"}
      selected={selected}
      dimmed={!dept || !dept.isActive}
      onSelect={() => select(dept ? { kind: "department", id: dept.id } : { kind: "zone", id: room.zone })}
    >
      {room.desks.map((desk, i) => {
        const agent = desk.agentId ? agentsById.get(desk.agentId) : undefined;
        const placement = agent ? layout.placements.get(agent.id) : undefined;
        return (
          <group key={i}>
            <EmployeeStation
              position={desk.position}
              occupied={!!agent}
              screenColor={agent && agent.officeStatus !== "available" ? OFFICE_STATUS_COLORS[agent.officeStatus] : agent ? "#1d3a6e" : null}
            />
            {agent && placement && <EmployeeCharacter agent={agent} position={placement.position} rotationY={placement.rotationY} />}
          </group>
        );
      })}
      {room.overflow > 0 && (
        <Html position={[room.center[0], 0.3, room.center[2] + 3.6]} center style={{ pointerEvents: "none" }}>
          <div className="rounded bg-black/70 px-2 py-0.5 text-[11px] text-slate-300">+{room.overflow} sem estação (ver painel)</div>
        </Html>
      )}
      {dept && working > 0 && <pointLight position={[room.center[0], 2.1, room.center[2]]} color={color} intensity={2.5} distance={8} decay={2} />}
    </RoomShell>
  );
}
