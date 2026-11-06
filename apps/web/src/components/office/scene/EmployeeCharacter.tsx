"use client";
import { OFFICE_STATUS_COLORS, OFFICE_STATUS_LABELS } from "@vc/core/client";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { useOfficeStore } from "../store";
import type { OfficeAgent, Vec3 } from "../types";
import { OfficeChair } from "./EmployeeStation";
import { Box } from "./primitives";
import { GEO, MAT } from "./shared";

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SKIN = ["#f2d3b1", "#e0b48f", "#c68a5e", "#a8693f", "#7a4a2a", "#5a3520"];
const HAIR = ["#1d1b1a", "#3b2a20", "#6b4a2b", "#b07a3c", "#d9c08a", "#8a8f99", "#2b3a67"];
const SHIRT = ["#3d7bff", "#22d3ee", "#a78bfa", "#14b8a6", "#f472b6", "#64748b", "#e2e8f0"];

/** Appearance derived from the agent's avatarSeed — same seed as the 2D avatar, so both match. */
export function appearance(seed: string) {
  const h = hash(seed);
  return {
    skin: SKIN[h % SKIN.length]!,
    hair: HAIR[(h >>> 3) % HAIR.length]!,
    shirt: SHIRT[(h >>> 6) % SHIRT.length]!,
    hairStyle: (h >>> 9) % 3,
    glasses: ((h >>> 12) & 3) === 0,
    headset: ((h >>> 14) & 3) === 1,
  };
}

/**
 * Stylized seated character. Status is shown by a floor ring and a small indicator above the head
 * (pulsing only while a task is executing). Clicking selects the employee — it never runs actions.
 */
export function EmployeeCharacter({
  agent,
  position,
  rotationY,
  onSofa = false,
}: {
  agent: OfficeAgent;
  position: Vec3;
  rotationY: number;
  onSofa?: boolean;
}) {
  const look = appearance(agent.avatarSeed);
  const color = OFFICE_STATUS_COLORS[agent.officeStatus];
  const selected = useOfficeStore((s) => s.selection?.kind === "agent" && s.selection.id === agent.id);
  const hovered = useOfficeStore((s) => s.hovered === agent.id);
  const animate = useOfficeStore((s) => s.quality === "high");
  const select = useOfficeStore((s) => s.select);
  const setHovered = useOfficeStore((s) => s.setHovered);
  const orb = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Group>(null);
  const executing = agent.officeStatus === "executing";

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime + (hash(agent.id) % 100) / 10;
    if (orb.current) {
      orb.current.position.y = 1.78 + Math.sin(t * 2) * 0.04;
      const s = executing ? 0.07 + Math.sin(t * 6) * 0.015 : 0.06;
      orb.current.scale.setScalar(s);
    }
    // subtle typing motion while executing, breathing otherwise
    if (body.current) body.current.position.y = executing ? Math.abs(Math.sin(t * 9)) * 0.008 : Math.sin(t * 1.3) * 0.006;
  });

  const material = (c: string) => MAT.solid(c, 0.55);

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: "agent", id: agent.id });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(agent.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(null);
        document.body.style.cursor = "";
      }}
    >
      {!onSofa && <OfficeChair position={[0, 0, -0.08]} />}
      {/* status ring */}
      <mesh geometry={GEO.ring} material={MAT.neon(color, selected ? 2.4 : 1.1)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={selected || hovered ? 1.35 : 1.1} />
      <group ref={body}>
        {/* torso */}
        <mesh geometry={GEO.capsule} material={material(look.shirt)} position={[0, 0.88, -0.02]} scale={[0.21, 0.17, 0.16]} castShadow />
        {/* arms reaching the desk */}
        <Box material={material(look.shirt)} position={[-0.24, 0.86, 0.14]} size={[0.09, 0.09, 0.36]} />
        <Box material={material(look.shirt)} position={[0.24, 0.86, 0.14]} size={[0.09, 0.09, 0.36]} />
        <mesh geometry={GEO.sphere} material={material(look.skin)} position={[-0.24, 0.86, 0.34]} scale={0.055} />
        <mesh geometry={GEO.sphere} material={material(look.skin)} position={[0.24, 0.86, 0.34]} scale={0.055} />
        {/* legs */}
        <Box material={MAT.solid("#1f2633")} position={[-0.1, 0.52, 0.16]} size={[0.13, 0.12, 0.42]} />
        <Box material={MAT.solid("#1f2633")} position={[0.1, 0.52, 0.16]} size={[0.13, 0.12, 0.42]} />
        {/* neck + head */}
        <mesh geometry={GEO.cylinder} material={material(look.skin)} position={[0, 1.2, 0]} scale={[0.06, 0.1, 0.06]} />
        <mesh geometry={GEO.sphere} material={material(look.skin)} position={[0, 1.38, 0]} scale={[0.16, 0.18, 0.16]} castShadow />
        {/* hair */}
        {look.hairStyle === 0 && <mesh geometry={GEO.sphere} material={material(look.hair)} position={[0, 1.45, -0.02]} scale={[0.17, 0.13, 0.17]} />}
        {look.hairStyle === 1 && <mesh geometry={GEO.sphere} material={material(look.hair)} position={[0, 1.41, -0.04]} scale={[0.175, 0.19, 0.17]} />}
        {look.hairStyle === 2 && (
          <>
            <mesh geometry={GEO.sphere} material={material(look.hair)} position={[0, 1.44, -0.03]} scale={[0.175, 0.15, 0.17]} />
            <Box material={material(look.hair)} position={[0, 1.28, -0.12]} size={[0.3, 0.28, 0.08]} />
          </>
        )}
        {/* eyes */}
        <mesh geometry={GEO.sphere} material={MAT.solid("#141821")} position={[-0.055, 1.39, 0.15]} scale={0.018} />
        <mesh geometry={GEO.sphere} material={MAT.solid("#141821")} position={[0.055, 1.39, 0.15]} scale={0.018} />
        {look.glasses && <Box material={MAT.solid("#cfd8e6", 0.2)} position={[0, 1.39, 0.16]} size={[0.2, 0.015, 0.01]} />}
        {look.headset && <mesh geometry={GEO.torus} material={MAT.solid("#3d7bff", 0.3)} position={[0, 1.4, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.19, 0.19, 1.5]} />}
      </group>
      {/* status indicator */}
      <mesh ref={orb} geometry={GEO.sphere} material={MAT.neon(color, 2)} position={[0, 1.78, 0]} scale={0.06} />
      {(hovered || selected) && (
        <Html position={[0, 2.05, 0]} center zIndexRange={[40, 20]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border border-white/10 bg-[#0b0f16]/90 px-2.5 py-1.5 text-center shadow-xl">
            <div className="text-[12px] font-semibold text-white">{agent.name}</div>
            <div className="text-[11px] text-slate-400">{agent.title}</div>
            <div className="mt-0.5 text-[11px]" style={{ color }}>
              {OFFICE_STATUS_LABELS[agent.officeStatus]}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
