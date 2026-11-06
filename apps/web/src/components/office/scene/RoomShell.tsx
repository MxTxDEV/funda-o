"use client";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { ROOM_D, ROOM_W } from "../layout";
import { useOfficeStore } from "../store";
import type { Vec3 } from "../types";
import { Box } from "./primitives";
import { MAT } from "./shared";
import { signTexture } from "./textures";

export type FloorFinish = "oak" | "walnut" | "ash" | "carpet" | "carpetBlue";
type Side = "-x" | "+x" | "-z" | "+z";

const H = 2.7; // partition height (ceiling cut away above for the diorama view)

/** Glass partition: aluminium base/top rails, vertical mullions and glass panes. */
function GlassPartition({ from, to, accent, glow }: { from: [number, number]; to: [number, number]; accent: string; glow: boolean }) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const size = (l: number, h: number, t: number): [number, number, number] => (alongX ? [l, h, t] : [t, h, l]);
  const mullions = Math.max(1, Math.round(len / 1.5));
  return (
    <group>
      <Box material={MAT.glass()} position={[cx, H / 2, cz]} size={size(len, H, 0.02)} />
      <Box material={MAT.aluminium()} position={[cx, 0.04, cz]} size={size(len, 0.08, 0.07)} />
      <Box material={glow ? MAT.emissive(accent, 1.4) : MAT.aluminium()} position={[cx, H, cz]} size={size(len, 0.06, 0.07)} />
      {Array.from({ length: mullions + 1 }, (_, i) => {
        const t = i / mullions;
        return <Box key={i} material={MAT.aluminium()} position={[x1 + (x2 - x1) * t, H / 2, z1 + (z2 - z1) * t]} size={size(0.035, H, 0.06)} />;
      })}
    </group>
  );
}

/**
 * Room architecture: floor finish, glass partitions with a glass door facing the corridor, a
 * wood-slat feature wall with the department sign and a discreet accent light line.
 * Any click inside bubbles up to the room (employees stop propagation).
 */
export function RoomShell({
  id,
  center,
  color,
  title,
  subtitle,
  floor,
  selected,
  dimmed,
  onSelect,
  children,
}: {
  id: string;
  center: Vec3;
  color: string;
  title: string;
  subtitle?: string;
  floor: FloorFinish;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
}) {
  const [cx, , cz] = center;
  const w = ROOM_W;
  const d = ROOM_D;
  const hovered = useOfficeStore((s) => s.hovered === `room:${id}`);
  const setHovered = useOfficeStore((s) => s.setHovered);
  // Door faces the central corridor; the feature wall is on the opposite side.
  const door: Side = cx === 0 ? (cz < 0 ? "+z" : "-z") : cx < 0 ? "+x" : "-x";
  // Opaque feature wall always on a back side (-z / -x) so it never hides the room from the camera.
  const feature: Side = door === "-z" ? "-x" : door === "-x" ? "-z" : door === "+z" ? "-z" : "-x";
  const floorMat =
    floor === "carpet" ? MAT.carpet("#2a2f3a") : floor === "carpetBlue" ? MAT.carpet("#1e2a44") : MAT.woodFloor(floor);

  const edge = (side: Side): [[number, number], [number, number]] => {
    switch (side) {
      case "-x":
        return [[cx - w / 2, cz - d / 2], [cx - w / 2, cz + d / 2]];
      case "+x":
        return [[cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2]];
      case "-z":
        return [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2]];
      case "+z":
        return [[cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2]];
    }
  };

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.();
  };
  const glow = !!selected || hovered;

  // Feature wall geometry
  const [[fx1, fz1], [fx2, fz2]] = edge(feature);
  const fAlongX = feature.endsWith("z");
  const inward = feature.startsWith("+") ? -1 : 1;
  const fcx = (fx1 + fx2) / 2 + (fAlongX ? 0 : inward * 0.08);
  const fcz = (fz1 + fz2) / 2 + (fAlongX ? inward * 0.08 : 0);
  const signRot = fAlongX ? (feature === "-z" ? 0 : Math.PI) : feature === "-x" ? Math.PI / 2 : -Math.PI / 2;
  const signOffset: [number, number] = fAlongX ? [0, inward * 0.08] : [inward * 0.08, 0];

  return (
    <group
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(`room:${id}`);
        if (onSelect) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = "";
      }}
    >
      <Box material={floorMat} position={[cx, 0.025, cz]} size={[w, 0.03, d]} receiveShadow />
      {selected && (
        <mesh position={[cx, 0.045, cz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - 0.2, d - 0.2]} />
          <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {(["-x", "+x", "-z", "+z"] as const)
        .filter((s) => s !== feature)
        .map((side) => {
          const [a, b] = edge(side);
          if (side !== door) return <GlassPartition key={side} from={a} to={b} accent={color} glow={glow} />;
          // door opening in the middle with an open glass door leaf
          const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const alongX = side.endsWith("z");
          const gap = 0.6;
          const left: [number, number] = alongX ? [mid[0] - gap, mid[1]] : [mid[0], mid[1] - gap];
          const right: [number, number] = alongX ? [mid[0] + gap, mid[1]] : [mid[0], mid[1] + gap];
          const swing = side.startsWith("+") ? -1 : 1;
          return (
            <group key={side}>
              <GlassPartition from={a} to={left} accent={color} glow={glow} />
              <GlassPartition from={right} to={b} accent={color} glow={glow} />
              <group position={[left[0], 0, left[1]]} rotation={[0, alongX ? swing * 0.7 : Math.PI / 2 + swing * 0.7, 0]}>
                <Box material={MAT.glass()} position={[0.58, 1.1, 0]} size={[1.12, 2.2, 0.02]} />
                <Box material={MAT.aluminium()} position={[0.58, 2.2, 0]} size={[1.14, 0.04, 0.04]} />
                <Box material={MAT.chrome()} position={[1.0, 1.05, 0.04]} size={[0.025, 0.5, 0.025]} />
              </group>
            </group>
          );
        })}

      {/* feature wall: slats + sign + accent line */}
      <Box
        material={MAT.slats(floor === "walnut" ? "#4a3324" : "#6b4f36")}
        position={[(fx1 + fx2) / 2, H / 2, (fz1 + fz2) / 2]}
        size={fAlongX ? [w, H, 0.14] : [0.14, H, d]}
        castShadow
        receiveShadow
      />
      <mesh position={[fcx + signOffset[0] * 0.1, 1.85, fcz + signOffset[1] * 0.1]} rotation={[0, signRot, 0]}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial map={signTexture(title, color, subtitle)} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <Box
        material={MAT.emissive(color, dimmed ? 0.3 : glow ? 2 : 0.9)}
        position={[fcx, 0.9, fcz]}
        size={fAlongX ? [w - 0.4, 0.02, 0.02] : [0.02, 0.02, d - 0.4]}
      />

      {(selected || hovered) && (
        <Html position={[cx, H + 0.6, cz]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border px-2.5 py-1 text-[12px] font-semibold text-white shadow-lg backdrop-blur" style={{ borderColor: `${color}99`, background: "rgba(9,12,17,0.82)" }}>
            {title}
          </div>
        </Html>
      )}
      {children}
    </group>
  );
}
