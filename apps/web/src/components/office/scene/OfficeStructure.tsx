"use client";
import { FLOOR_D, FLOOR_W } from "../layout";
import { Box } from "./primitives";
import { MAT } from "./shared";

const WALL_H = 3.2;

/** Exterior wall with a continuous window band and black mullions. */
function WindowWall({ axis, at, length }: { axis: "x" | "z"; at: number; length: number }) {
  const mullions = Math.floor(length / 2.2);
  const along = (v: number, y: number, size: [number, number, number]) =>
    axis === "x" ? { position: [v, y, at] as [number, number, number], size } : { position: [at, y, v] as [number, number, number], size: [size[2], size[1], size[0]] as [number, number, number] };
  const parts = [
    along(0, 0.45, [length, 0.9, 0.3]),
    along(0, WALL_H - 0.25, [length, 0.5, 0.3]),
  ];
  return (
    <group>
      {parts.map((p, i) => (
        <Box key={i} material={MAT.wall()} position={p.position} size={p.size} receiveShadow castShadow />
      ))}
      {(() => {
        const g = along(0, 1.8, [length, 1.8, 0.03]);
        return <Box material={MAT.glass()} position={g.position} size={g.size} />;
      })()}
      {Array.from({ length: mullions + 1 }, (_, i) => {
        const v = -length / 2 + (i * length) / mullions;
        const m = along(v, 1.8, [0.06, 1.8, 0.12]);
        return <Box key={i} material={MAT.blackMetal()} position={m.position} size={m.size} />;
      })}
      {(() => {
        const sill = along(0, 0.92, [length, 0.04, 0.36]);
        return <Box material={MAT.aluminium()} position={sill.position} size={sill.size} />;
      })()}
    </group>
  );
}

/**
 * Building shell: polished concrete slab, exterior walls with windows (back/left), structural
 * columns, and a cut-away section on the front/right edges (diorama view, ceiling removed).
 */
export function OfficeStructure() {
  const hw = FLOOR_W / 2;
  const hd = FLOOR_D / 2;
  return (
    <group>
      {/* surroundings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#06080b" roughness={1} />
      </mesh>
      {/* slab with visible cut section */}
      <Box material={MAT.wallDark()} position={[0, -0.16, 0]} size={[FLOOR_W + 0.6, 0.3, FLOOR_D + 0.6]} receiveShadow />
      <Box material={MAT.concrete()} position={[0, 0.0, 0]} size={[FLOOR_W, 0.02, FLOOR_D]} receiveShadow />
      {/* exterior walls with windows */}
      <WindowWall axis="x" at={-hd - 0.15} length={FLOOR_W + 0.6} />
      <WindowWall axis="z" at={-hw - 0.15} length={FLOOR_D + 0.6} />
      {/* front/right low parapets (section cut) */}
      <Box material={MAT.wallDark()} position={[0, 0.18, hd + 0.15]} size={[FLOOR_W + 0.6, 0.36, 0.3]} />
      <Box material={MAT.wallDark()} position={[hw + 0.15, 0.18, 0]} size={[0.3, 0.36, FLOOR_D + 0.6]} />
      <Box material={MAT.emissive("#3d7bff", 0.6)} position={[0, 0.37, hd + 0.3]} size={[FLOOR_W + 0.6, 0.015, 0.015]} />
      <Box material={MAT.emissive("#3d7bff", 0.6)} position={[hw + 0.3, 0.37, 0]} size={[0.015, 0.015, FLOOR_D + 0.6]} />
      {/* structural columns at corridor crossings */}
      {[-7, 7].flatMap((x) => [-5, 5].map((z) => <Box key={`${x}:${z}`} material={MAT.wall()} position={[x, WALL_H / 2, z]} size={[0.5, WALL_H, 0.5]} castShadow receiveShadow />))}
      {/* corridor floor guide lines (subtle) */}
      {[-5, 5].map((z) => (
        <Box key={z} material={MAT.emissive("#1f3f7a", 0.5)} position={[0, 0.012, z]} size={[FLOOR_W - 2, 0.002, 0.03]} />
      ))}
    </group>
  );
}
