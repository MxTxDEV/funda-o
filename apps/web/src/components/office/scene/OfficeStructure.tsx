"use client";
import { Grid } from "@react-three/drei";
import { FLOOR_D, FLOOR_W } from "../layout";
import { Box } from "./primitives";
import { MAT } from "./shared";

/** Building shell: floor slab, grid, perimeter walls with a discreet neon trim and plants. */
export function OfficeStructure() {
  const h = 2.8;
  return (
    <group>
      <Box material={MAT.floor()} position={[0, -0.06, 0]} size={[FLOOR_W + 2, 0.12, FLOOR_D + 2]} receiveShadow />
      <Grid
        position={[0, 0.005, 0]}
        args={[FLOOR_W, FLOOR_D]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#141b26"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#1b2c4d"
        fadeDistance={90}
        fadeStrength={1}
        infiniteGrid={false}
      />
      {/* Back and left perimeter walls (the camera looks from the front-right). */}
      <Box material={MAT.wall()} position={[0, h / 2, -FLOOR_D / 2 - 0.5]} size={[FLOOR_W + 2, h, 0.25]} />
      <Box material={MAT.wall()} position={[-FLOOR_W / 2 - 0.5, h / 2, 0]} size={[0.25, h, FLOOR_D + 2]} />
      <Box material={MAT.neon("#3d7bff", 0.9)} position={[0, h, -FLOOR_D / 2 - 0.36]} size={[FLOOR_W + 2, 0.03, 0.03]} />
      <Box material={MAT.neon("#3d7bff", 0.9)} position={[-FLOOR_W / 2 - 0.36, h, 0]} size={[0.03, 0.03, FLOOR_D + 2]} />
      {/* Window strips on the back wall */}
      {[-16, -8, 0, 8, 16].map((x) => (
        <Box key={x} material={MAT.glass()} position={[x, 1.6, -FLOOR_D / 2 - 0.36]} size={[5.5, 1.6, 0.02]} />
      ))}
      {/* Plants along the corridors */}
      {[
        [-7, -15],
        [7, -15],
        [-21, -5],
        [-21, 5],
        [7, 15],
        [-7, 15],
      ].map(([x, z]) => (
        <Plant key={`${x}:${z}`} x={x!} z={z!} />
      ))}
    </group>
  );
}

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box material={MAT.dark()} position={[0, 0.25, 0]} size={[0.5, 0.5, 0.5]} />
      <mesh position={[0, 0.85, 0]} scale={[0.42, 0.6, 0.42]} material={MAT.plant()}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  );
}
