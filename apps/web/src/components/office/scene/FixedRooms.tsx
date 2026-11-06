"use client";
import { Html } from "@react-three/drei";
import { FIXED_ROOM_LABELS, ROOM_CENTERS } from "../layout";
import { useOfficeStore } from "../store";
import type { OfficeAgent } from "../types";
import { OfficeChair } from "./EmployeeStation";
import { Box, Cylinder } from "./primitives";
import { RoomShell } from "./RoomShell";
import { MAT } from "./shared";

function useRoomSelection(id: "executive" | "meeting" | "lounge") {
  const selected = useOfficeStore((s) => s.selection?.kind === "room" && s.selection.id === id);
  const select = useOfficeStore((s) => s.select);
  return { selected, onSelect: () => select({ kind: "room", id }) };
}

/** Wall screen showing real values (HTML overlay rendered on a 3D panel). */
function WallScreen({ position, rotationY = 0, lines }: { position: [number, number, number]; rotationY?: number; lines: [string, string | number][] }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Box material={MAT.dark()} position={[0, 0, 0]} size={[2.2, 1.25, 0.06]} />
      <Box material={MAT.screen("#1a3a7a")} position={[0, 0, 0.035]} size={[2.1, 1.15, 0.005]} />
      <Html position={[0, 0, 0.05]} transform distanceFactor={1.35} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-[300px] select-none p-3 text-white">
          {lines.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-white/10 py-1.5 last:border-0">
              <span className="text-[13px] text-slate-300">{k}</span>
              <span className="text-[22px] font-semibold tabular-nums text-[#9dbbff]">{v}</span>
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
}

export function ExecutiveRoom({ pendingApprovals, activeTasks }: { pendingApprovals: number; activeTasks: number }) {
  const [cx, , cz] = ROOM_CENTERS.executive;
  const { selected, onSelect } = useRoomSelection("executive");
  return (
    <RoomShell center={ROOM_CENTERS.executive} color="#c9a227" title={FIXED_ROOM_LABELS.executive} subtitle="gestão e aprovações" selected={selected} onSelect={onSelect}>
      {/* executive desk */}
      <Box material={MAT.solid("#2a2118", 0.45)} position={[cx, 0.76, cz - 0.6]} size={[3.2, 0.08, 1.2]} />
      <Box material={MAT.solid("#1a1510", 0.5)} position={[cx, 0.38, cz - 0.6]} size={[3.0, 0.72, 0.1]} />
      <Box material={MAT.dark()} position={[cx - 0.5, 1.1, cz - 0.95]} size={[0.8, 0.46, 0.04]} />
      <Box material={MAT.screen("#3d7bff")} position={[cx - 0.5, 1.1, cz - 0.925]} size={[0.76, 0.42, 0.005]} />
      <Box material={MAT.dark()} position={[cx + 0.5, 1.1, cz - 0.95]} size={[0.8, 0.46, 0.04]} />
      <Box material={MAT.screen("#3d7bff")} position={[cx + 0.5, 1.1, cz - 0.925]} size={[0.76, 0.42, 0.005]} />
      <OfficeChair position={[cx, 0, cz - 1.6]} executive />
      {/* decision area: KPI screens with real numbers */}
      <WallScreen position={[cx - 2.6, 1.6, cz - 4.05]} lines={[["Aprovações pendentes", pendingApprovals], ["Tarefas ativas", activeTasks]]} />
      <Box material={MAT.fabric("#1d2533")} position={[cx + 3.6, 0.3, cz + 1.8]} size={[2.2, 0.6, 0.9]} />
      <Cylinder material={MAT.solid("#2a2118", 0.45)} position={[cx + 3.6, 0.3, cz + 0.6]} size={[0.5, 0.6, 0.5]} />
    </RoomShell>
  );
}

export function MeetingRoom() {
  const [cx, , cz] = ROOM_CENTERS.meeting;
  const { selected, onSelect } = useRoomSelection("meeting");
  const chairs: { p: [number, number, number]; r: number }[] = [];
  for (let i = 0; i < 4; i++) {
    chairs.push({ p: [cx - 2.1 + i * 1.4, 0, cz - 1.25], r: 0 });
    chairs.push({ p: [cx - 2.1 + i * 1.4, 0, cz + 1.25], r: Math.PI });
  }
  return (
    <RoomShell center={ROOM_CENTERS.meeting} color="#22d3ee" title={FIXED_ROOM_LABELS.meeting} subtitle="nenhuma reunião ativa" selected={selected} onSelect={onSelect}>
      <Box material={MAT.deskTop()} position={[cx, 0.76, cz]} size={[6, 0.07, 1.6]} />
      <Box material={MAT.deskLeg()} position={[cx - 2.4, 0.38, cz]} size={[0.1, 0.72, 1.2]} />
      <Box material={MAT.deskLeg()} position={[cx + 2.4, 0.38, cz]} size={[0.1, 0.72, 1.2]} />
      {chairs.map(({ p, r }, i) => (
        <group key={i} position={p} rotation={[0, r, 0]}>
          <OfficeChair position={[0, 0, 0]} />
        </group>
      ))}
      {/* presentation screen */}
      <Box material={MAT.dark()} position={[cx + 5.85, 1.5, cz]} size={[0.06, 1.6, 2.8]} />
      <Box material={MAT.screen("#0e2a55")} position={[cx + 5.81, 1.5, cz]} size={[0.005, 1.5, 2.7]} />
    </RoomShell>
  );
}

/** Lounge: real "rest" state = agents with status paused sit here (see layout.ts). */
export function RecreationRoom({ resting }: { resting: OfficeAgent[] }) {
  const [cx, , cz] = ROOM_CENTERS.lounge;
  const { selected, onSelect } = useRoomSelection("lounge");
  return (
    <RoomShell
      center={ROOM_CENTERS.lounge}
      color="#a78bfa"
      title={FIXED_ROOM_LABELS.lounge}
      subtitle={resting.length ? `${resting.length} em descanso` : "vazia"}
      selected={selected}
      onSelect={onSelect}
    >
      {/* L-shaped sofa */}
      <Box material={MAT.fabric("#2b2f45")} position={[cx - 0.6, 0.25, cz - 2.2]} size={[5.2, 0.5, 0.9]} />
      <Box material={MAT.fabric("#2b2f45")} position={[cx - 0.6, 0.6, cz - 2.6]} size={[5.2, 0.7, 0.2]} />
      <Box material={MAT.fabric("#2b2f45")} position={[cx - 4.2, 0.25, cz + 0.2]} size={[0.9, 0.5, 4]} />
      <Box material={MAT.fabric("#2b2f45")} position={[cx - 4.6, 0.6, cz + 0.2]} size={[0.2, 0.7, 4]} />
      {/* coffee table + rug */}
      <Box material={MAT.fabric("#1c1f33")} position={[cx - 1.4, 0.03, cz - 0.3]} size={[4, 0.02, 3]} />
      <Box material={MAT.solid("#3a3f55", 0.4)} position={[cx - 1.4, 0.3, cz - 0.4]} size={[1.6, 0.06, 0.8]} />
      {/* TV */}
      <Box material={MAT.dark()} position={[cx - 1.2, 1.4, cz + 4.0]} size={[2.6, 1.4, 0.06]} />
      <Box material={MAT.screen("#3b1f6e")} position={[cx - 1.2, 1.4, cz + 3.96]} size={[2.5, 1.3, 0.005]} />
      {/* game table */}
      <Box material={MAT.solid("#14532d", 0.7)} position={[cx + 3.4, 0.78, cz + 1.4]} size={[1.6, 0.06, 2.6]} />
      <Box material={MAT.deskLeg()} position={[cx + 3.4, 0.39, cz + 1.4]} size={[1.2, 0.76, 0.1]} />
      <Box material={MAT.solid("#e2e8f0")} position={[cx + 3.4, 0.88, cz + 1.4]} size={[1.6, 0.14, 0.02]} />
      <pointLight position={[cx, 2.2, cz]} color="#a78bfa" intensity={4} distance={9} decay={2} />
    </RoomShell>
  );
}
