"use client";
import type { Vec3 } from "../types";
import { Box, Cylinder } from "./primitives";
import { MAT } from "./shared";

/** Workstation: desk, monitor (lit with the occupant's status color), keyboard and chair. */
export function EmployeeStation({ position, screenColor, occupied }: { position: Vec3; screenColor: string | null; occupied: boolean }) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z]}>
      <Box material={MAT.deskTop()} position={[0, 0.74, 0]} size={[1.5, 0.05, 0.75]} castShadow />
      <Box material={MAT.deskLeg()} position={[-0.68, 0.37, 0]} size={[0.05, 0.72, 0.65]} />
      <Box material={MAT.deskLeg()} position={[0.68, 0.37, 0]} size={[0.05, 0.72, 0.65]} />
      {/* monitor faces the occupant (who sits on the -z side) */}
      <Box material={MAT.dark()} position={[0, 0.79, 0.18]} size={[0.22, 0.03, 0.14]} />
      <Box material={MAT.dark()} position={[0, 0.92, 0.2]} size={[0.04, 0.24, 0.04]} />
      <Box material={MAT.dark()} position={[0, 1.08, 0.2]} size={[0.72, 0.42, 0.035]} />
      <Box material={screenColor ? MAT.screen(screenColor) : MAT.screenOff()} position={[0, 1.08, 0.18]} size={[0.68, 0.38, 0.005]} />
      <Box material={MAT.dark()} position={[0, 0.775, -0.12]} size={[0.5, 0.015, 0.16]} />
      {!occupied && <OfficeChair position={[0, 0, -0.75]} />}
    </group>
  );
}

export function OfficeChair({ position, executive = false }: { position: Vec3; executive?: boolean }) {
  return (
    <group position={position}>
      <Cylinder material={MAT.deskLeg()} position={[0, 0.22, 0]} size={[0.04, 0.44, 0.04]} />
      <Cylinder material={MAT.deskLeg()} position={[0, 0.03, 0]} size={[0.28, 0.04, 0.28]} />
      <Box material={MAT.chair()} position={[0, 0.48, 0]} size={[0.52, 0.08, 0.5]} />
      <Box material={MAT.chair()} position={[0, executive ? 0.98 : 0.82, -0.23]} size={[0.5, executive ? 0.95 : 0.62, 0.07]} />
    </group>
  );
}
