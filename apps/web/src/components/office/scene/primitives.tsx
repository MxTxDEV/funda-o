"use client";
import type { ThreeElements } from "@react-three/fiber";
import type * as THREE from "three";
import { GEO } from "./shared";
import type { Vec3 } from "../types";

type MeshProps = Omit<ThreeElements["mesh"], "geometry" | "material" | "scale" | "position"> & {
  material: THREE.Material;
  position?: Vec3;
  size: Vec3;
};

/** Axis-aligned box using the shared unit geometry (scaled), so no new geometry is allocated. */
export function Box({ material, position = [0, 0, 0], size, ...rest }: MeshProps) {
  return <mesh geometry={GEO.box} material={material} position={position} scale={size} {...rest} />;
}

export function Cylinder({ material, position = [0, 0, 0], size, ...rest }: MeshProps) {
  return <mesh geometry={GEO.cylinder} material={material} position={position} scale={size} {...rest} />;
}
