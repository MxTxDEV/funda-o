"use client";
import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { ROOM_D, ROOM_W } from "../layout";
import type { Vec3 } from "../types";
import { Box } from "./primitives";
import { MAT } from "./shared";

/**
 * Glass-walled room: tinted floor, glass partitions with neon top trim, a door gap facing the
 * central corridor and a floating name plate. Clicking the floor selects the room.
 */
export function RoomShell({
  center,
  color,
  title,
  subtitle,
  selected,
  dimmed,
  onSelect,
  children,
}: {
  center: Vec3;
  color: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
}) {
  const [cx, , cz] = center;
  const w = ROOM_W;
  const d = ROOM_D;
  const h = 2.2;
  const doorSide: "x" | "z" = cx === 0 ? "z" : "x";
  const doorTowardsPositive = doorSide === "x" ? cx < 0 : cz < 0;
  const trim = MAT.neon(color, selected ? 2.2 : 0.7);

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.();
  };

  // Clicks on anything inside the room (floor, furniture, glass) bubble up to this group;
  // employees stop propagation so they take precedence.
  return (
    <group
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (onSelect) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {/* floor */}
      <Box material={MAT.roomFloor(color)} position={[cx, 0.02, cz]} size={[w, 0.04, d]} />
      {/* selection outline on the floor */}
      <Box material={MAT.neon(color, selected ? 1.6 : dimmed ? 0.15 : 0.45)} position={[cx, 0.045, cz - d / 2]} size={[w, 0.01, 0.06]} />
      <Box material={MAT.neon(color, selected ? 1.6 : dimmed ? 0.15 : 0.45)} position={[cx, 0.045, cz + d / 2]} size={[w, 0.01, 0.06]} />
      <Box material={MAT.neon(color, selected ? 1.6 : dimmed ? 0.15 : 0.45)} position={[cx - w / 2, 0.045, cz]} size={[0.06, 0.01, d]} />
      <Box material={MAT.neon(color, selected ? 1.6 : dimmed ? 0.15 : 0.45)} position={[cx + w / 2, 0.045, cz]} size={[0.06, 0.01, d]} />

      {/* glass walls (door gap on the side facing the central corridor) */}
      {(["-x", "+x", "-z", "+z"] as const).map((side) => {
        const isX = side.endsWith("x");
        const positive = side.startsWith("+");
        const isDoor = (doorSide === "x" && isX && positive === doorTowardsPositive) || (doorSide === "z" && !isX && positive === doorTowardsPositive);
        const len = isX ? d : w;
        const px = isX ? cx + (positive ? w / 2 : -w / 2) : cx;
        const pz = isX ? cz : cz + (positive ? d / 2 : -d / 2);
        const segs: [number, number][] = isDoor
          ? [
              [-len / 2, -1.1],
              [1.1, len / 2],
            ]
          : [[-len / 2, len / 2]];
        return segs.map(([a, b]) => {
          const mid = (a + b) / 2;
          const l = b - a;
          const pos: Vec3 = isX ? [px, h / 2, pz + mid] : [px + mid, h / 2, pz];
          const size: Vec3 = isX ? [0.04, h, l] : [l, h, 0.04];
          const top: Vec3 = isX ? [px, h, pz + mid] : [px + mid, h, pz];
          const topSize: Vec3 = isX ? [0.05, 0.03, l] : [l, 0.03, 0.05];
          return (
            <group key={`${side}:${a}`}>
              <Box material={MAT.glass()} position={pos} size={size} />
              <Box material={trim} position={top} size={topSize} />
            </group>
          );
        });
      })}

      <Html position={[cx, h + 0.55, cz - d / 2]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap text-center select-none">
          <div
            className="rounded-md border px-2.5 py-1 text-[12px] font-semibold tracking-wide text-white shadow-lg backdrop-blur"
            style={{ borderColor: `${color}88`, background: "rgba(9,12,17,0.78)", boxShadow: selected ? `0 0 18px ${color}88` : undefined }}
          >
            {title}
          </div>
          {subtitle && <div className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-slate-400">{subtitle}</div>}
        </div>
      </Html>
      {children}
    </group>
  );
}
