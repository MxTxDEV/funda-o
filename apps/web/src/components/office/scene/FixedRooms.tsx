"use client";
import { Html } from "@react-three/drei";
import { FIXED_ROOM_LABELS, ROOM_CENTERS } from "../layout";
import { useOfficeStore } from "../store";
import { Box } from "./primitives";
import { RoomShell } from "./RoomShell";
import { MAT } from "./shared";
import { panelTexture } from "./textures";

function useRoomSelection(id: "meeting" | "lounge") {
  const selected = useOfficeStore((s) => s.selection?.kind === "room" && s.selection.id === id);
  const select = useOfficeStore((s) => s.select);
  return { selected, onSelect: () => select({ kind: "room", id }) };
}

/** Flat screen on a wall/stand showing a texture (only real or explanatory content). */
export function Screen({ position, rotationY = 0, width = 2.2, lines, accent }: { position: [number, number, number]; rotationY?: number; width?: number; lines: string[]; accent?: string }) {
  const h = width * 0.5625;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Box material={MAT.plasticDark()} position={[0, 0, 0]} size={[width + 0.06, h + 0.06, 0.05]} castShadow />
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial map={panelTexture(lines, accent)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Real-number display for the Diretoria (HTML overlay on a 3D display stand). */
export function KpiDisplay({ position, rotationY, lines }: { position: [number, number, number]; rotationY: number; lines: [string, number][] }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Box material={MAT.blackMetal()} position={[0, 0.6, 0]} size={[0.08, 1.2, 0.08]} />
      <Box material={MAT.blackMetal()} position={[0, 0.02, 0]} size={[0.6, 0.04, 0.4]} />
      <Box material={MAT.plasticDark()} position={[0, 1.55, 0]} size={[1.5, 0.88, 0.05]} castShadow />
      <Box material={MAT.basic("#08101f")} position={[0, 1.55, 0.027]} size={[1.44, 0.82, 0.002]} />
      <Html position={[0, 1.55, 0.04]} transform distanceFactor={0.95} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-[300px] select-none p-3 text-white">
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[#9dbbff]">Indicadores em tempo real</div>
          {lines.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-white/10 py-1.5 last:border-0">
              <span className="text-[14px] text-slate-300">{k}</span>
              <span className="text-[24px] font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </Html>
    </group>
  );
}

export function MeetingRoom() {
  const [cx, , cz] = ROOM_CENTERS.meeting;
  const { selected, onSelect } = useRoomSelection("meeting");
  return (
    <RoomShell id="meeting" center={ROOM_CENTERS.meeting} color="#22d3ee" title={FIXED_ROOM_LABELS.meeting} subtitle="Colaboração" floor="carpetBlue" selected={selected} onSelect={onSelect}>
      <Screen position={[cx - 5.84, 1.55, cz]} rotationY={Math.PI / 2} width={2.6} lines={["Sala de Reuniões", "Nenhuma reunião ativa.", "Reuniões entre agentes: integração futura", "do Central Brain."]} accent="#22d3ee" />
    </RoomShell>
  );
}

export function RecreationRoom({ restingCount }: { restingCount: number }) {
  const [cx, , cz] = ROOM_CENTERS.lounge;
  const { selected, onSelect } = useRoomSelection("lounge");
  return (
    <RoomShell
      id="lounge"
      center={ROOM_CENTERS.lounge}
      color="#a78bfa"
      title={FIXED_ROOM_LABELS.lounge}
      subtitle={restingCount ? `${restingCount} em descanso` : "Descanso"}
      floor="ash"
      selected={selected}
      onSelect={onSelect}
    >
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx - 2.2, 0.045, cz - 0.4]} receiveShadow>
        <planeGeometry args={[5.2, 3.8]} />
        <primitive object={MAT.carpet("#3b3550")} attach="material" />
      </mesh>
      {/* media console + TV facing the main sofa */}
      <Box material={MAT.wood("walnut")} position={[cx - 1.2, 0.25, cz + 3.4]} size={[2.6, 0.5, 0.45]} castShadow />
      <Screen position={[cx - 1.2, 1.3, cz + 3.45]} rotationY={Math.PI} width={2.0} lines={["Sala de Lazer", "Funcionários pausados descansam aqui."]} accent="#a78bfa" />
      {/* coffee bar */}
      <Box material={MAT.wood("walnut")} position={[cx + 3.4, 0.5, cz - 3.65]} size={[3.2, 1.0, 0.6]} castShadow />
      <Box material={MAT.laminateWhite()} position={[cx + 3.4, 1.02, cz - 3.65]} size={[3.26, 0.04, 0.66]} />
      <Box material={MAT.blackMetal()} position={[cx + 2.6, 1.22, cz - 3.75]} size={[0.32, 0.36, 0.34]} castShadow />
      <Box material={MAT.chrome()} position={[cx + 2.6, 1.15, cz - 3.56]} size={[0.06, 0.05, 0.06]} />
      {[cx + 3.4, cx + 4.3].map((x) => (
        <group key={x} position={[x, 0, cz - 3.0]}>
          <Box material={MAT.chrome()} position={[0, 0.35, 0]} size={[0.04, 0.7, 0.04]} />
          <Box material={MAT.leather("#2a2420")} position={[0, 0.72, 0]} size={[0.36, 0.06, 0.36]} />
          <Box material={MAT.chrome()} position={[0, 0.01, 0]} size={[0.36, 0.02, 0.36]} />
        </group>
      ))}
      {/* foosball table */}
      <group position={[cx + 3.8, 0, cz + 2.2]}>
        <Box material={MAT.wood("walnut")} position={[0, 0.78, 0]} size={[1.4, 0.24, 0.8]} castShadow />
        <Box material={MAT.solid("#2f6b3f")} position={[0, 0.91, 0]} size={[1.3, 0.01, 0.7]} />
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <Box key={x} material={MAT.chrome()} position={[x, 0.95, 0]} size={[0.02, 0.02, 1.1]} />
        ))}
        {[-0.55, 0.55].flatMap((x) => [-0.3, 0.3].map((z) => <Box key={`${x}${z}`} material={MAT.blackMetal()} position={[x, 0.33, z]} size={[0.08, 0.66, 0.08]} />))}
      </group>
      <pointLight position={[cx - 1.5, 2.3, cz - 0.6]} color="#ffd9a8" intensity={2.2} distance={7} decay={2} />
    </RoomShell>
  );
}
