"use client";
import type { DepartmentRoom, OfficeLayout } from "../layout";
import { useOfficeStore } from "../store";
import type { OfficeAgent, OfficeSnapshot } from "../types";
import { EmployeeCharacter } from "./EmployeeCharacter";
import { KpiDisplay, Screen } from "./FixedRooms";
import { alongFeature } from "./furnishing";
import { Box } from "./primitives";
import { type FloorFinish, RoomShell } from "./RoomShell";
import { MAT } from "./shared";
import { artTexture } from "./textures";

const FLOORS: Record<string, FloorFinish> = { strategy: "oak", offers: "oak", design: "ash", funnels: "oak", traffic: "oak", executive: "walnut" };

/** A department room: architecture + zone decor + the real employees at their desks. */
export function DepartmentArea({
  room,
  layout,
  agentsById,
  metrics,
}: {
  room: DepartmentRoom;
  layout: OfficeLayout;
  agentsById: Map<string, OfficeAgent>;
  metrics: OfficeSnapshot["metrics"];
}) {
  const dept = room.department;
  const selection = useOfficeStore((s) => s.selection);
  const select = useOfficeStore((s) => s.select);
  const selected =
    (selection?.kind === "department" && dept?.id === selection.id) ||
    (selection?.kind === "zone" && selection.id === room.zone) ||
    (selection?.kind === "room" && selection.id === "executive" && room.zone === "executive");
  const color = dept?.color ?? "#5b6578";
  const c = room.center;

  return (
    <RoomShell
      id={room.zone}
      center={c}
      color={color}
      title={dept ? dept.name : room.zoneLabel}
      subtitle={dept ? room.zoneLabel : "sala disponível"}
      floor={FLOORS[room.zone] ?? "oak"}
      selected={selected}
      dimmed={!dept || !dept.isActive}
      onSelect={() => select(dept ? { kind: "department", id: dept.id } : { kind: "zone", id: room.zone })}
    >
      {room.zone === "executive" && <ExecutiveFurniture metrics={metrics} />}
      {room.zone === "design" && <ArtWall room={room} />}
      {room.zone === "traffic" && (
        <Screen {...screenOnFeature(room)} width={2.0} lines={["Tráfego & Performance", "Painel Meta Ads: integração futura.", "Nenhum dado é simulado."]} accent={color} />
      )}
      {room.desks.map((desk) => {
        const agent = desk.agentId ? agentsById.get(desk.agentId) : undefined;
        const placement = agent ? layout.placements.get(agent.id) : undefined;
        return agent && placement ? (
          <EmployeeCharacter key={agent.id} agent={agent} position={placement.position} rotationY={placement.rotationY} accent={color} departmentName={dept?.name} />
        ) : null;
      })}
    </RoomShell>
  );
}

function screenOnFeature(room: DepartmentRoom) {
  const at = alongFeature(room.center, 3.4, 0.2);
  return { position: [at.position[0], 1.75, at.position[2]] as [number, number, number], rotationY: at.rotationY };
}

function ArtWall({ room }: { room: DepartmentRoom }) {
  return (
    <>
      {[-3.6, 3.6].map((t, i) => {
        const at = alongFeature(room.center, t, 0.1);
        return (
          <group key={t} position={[at.position[0], 1.75, at.position[2]]} rotation={[0, at.rotationY, 0]}>
            <Box material={MAT.blackMetal()} position={[0, 0, 0]} size={[1.25, 0.9, 0.04]} />
            <mesh position={[0, 0, 0.022]}>
              <planeGeometry args={[1.15, 0.8]} />
              <meshStandardMaterial map={artTexture(17 + i, ["#3d7bff", "#a78bfa", "#22d3ee", "#f4b740", "#1b2230"])} roughness={0.8} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Diretoria: walnut executive desk with dual monitors, credenza, rug and a real-time KPI display. */
function ExecutiveFurniture({ metrics }: { metrics: OfficeSnapshot["metrics"] }) {
  const [x, , z] = [-1.0, 0, -11.0];
  return (
    <group>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.045, z - 0.3]} receiveShadow>
        <planeGeometry args={[4.4, 3.0]} />
        <primitive object={MAT.carpet("#2b2622")} attach="material" />
      </mesh>
      <Box material={MAT.wood("walnut")} position={[x, 0.75, z]} size={[2.4, 0.06, 1.05]} castShadow receiveShadow />
      <Box material={MAT.wood("walnut")} position={[x - 1.12, 0.37, z]} size={[0.08, 0.72, 0.98]} castShadow />
      <Box material={MAT.wood("walnut")} position={[x + 0.7, 0.37, z]} size={[0.9, 0.72, 0.98]} castShadow />
      <Box material={MAT.aluminium()} position={[x + 0.7, 0.55, z - 0.5]} size={[0.5, 0.015, 0.015]} />
      {[-0.42, 0.42].map((dx) => (
        <group key={dx}>
          <Box material={MAT.plasticDark()} position={[x + dx, 1.1, z + 0.2]} size={[0.78, 0.45, 0.03]} castShadow />
          <Box material={MAT.aluminium()} position={[x + dx, 0.92, z + 0.23]} size={[0.035, 0.32, 0.025]} />
        </group>
      ))}
      <Box material={MAT.plasticLight()} position={[x, 0.79, z - 0.15]} size={[0.44, 0.018, 0.14]} />
      <Box material={MAT.leather("#3a2a1e")} position={[x + 0.6, 0.79, z - 0.2]} size={[0.5, 0.01, 0.35]} />
      {/* credenza behind */}
      <Box material={MAT.wood("walnut")} position={[x, 0.38, z - 2.75]} size={[2.6, 0.7, 0.5]} castShadow />
      <KpiDisplay
        position={[x + 5.0, 0, z - 1.6]}
        rotationY={-0.65}
        lines={[
          ["Aprovações pendentes", metrics.pendingApprovals],
          ["Tarefas ativas", metrics.activeTasks],
          ["Funcionários executando", metrics.working],
        ]}
      />
    </group>
  );
}
