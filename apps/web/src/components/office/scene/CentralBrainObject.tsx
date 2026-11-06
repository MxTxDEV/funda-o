"use client";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { ROOM_CENTERS } from "../layout";
import { useOfficeStore } from "../store";
import { Box, Cylinder } from "./primitives";
import { GEO, MAT } from "./shared";

/**
 * Central Brain: circular platform with a holographic core. `activity` (0..1) comes from real
 * operational data (tasks executing / queued) and only drives the animation speed and glow.
 */
export function CentralBrainObject({ activity, integrated }: { activity: number; integrated: boolean }) {
  const [cx, , cz] = ROOM_CENTERS.brain;
  const core = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const selected = useOfficeStore((s) => s.selection?.kind === "room" && s.selection.id === "brain");
  const animate = useOfficeStore((s) => s.quality === "high");
  const select = useOfficeStore((s) => s.select);
  const speed = 0.25 + activity * 1.5;

  useFrame(({ clock }, delta) => {
    if (!animate) return;
    if (core.current) {
      core.current.rotation.y += delta * speed;
      core.current.rotation.x += delta * speed * 0.3;
    }
    if (ring1.current) ring1.current.rotation.z += delta * speed * 0.8;
    if (ring2.current) ring2.current.rotation.z -= delta * speed * 0.6;
    if (light.current) light.current.intensity = 14 + Math.sin(clock.elapsedTime * (1 + activity * 3)) * 3 + activity * 10;
  });

  const onSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select({ kind: "room", id: "brain" });
  };

  return (
    <group position={[cx, 0, cz]}>
      <Cylinder material={MAT.dark()} position={[0, 0.08, 0]} size={[3.4, 0.16, 3.4]} onClick={onSelect} />
      <mesh geometry={GEO.torus} material={MAT.neon("#3d7bff", selected ? 2.4 : 1.4)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]} scale={[3.4, 3.4, 1]} />
      <mesh geometry={GEO.torus} material={MAT.neon("#22d3ee", 0.8)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]} scale={[2.6, 2.6, 1]} />
      {/* pedestal */}
      <Cylinder material={MAT.deskLeg()} position={[0, 0.55, 0]} size={[0.9, 0.8, 0.9]} onClick={onSelect} />
      <mesh geometry={GEO.torus} material={MAT.neon("#3d7bff", 1.6)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.96, 0]} scale={[0.9, 0.9, 1]} />
      {/* hologram */}
      <group position={[0, 2.3, 0]} onClick={onSelect} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <mesh ref={core} geometry={GEO.ico} scale={0.95}>
          <meshStandardMaterial color="#3d7bff" emissive="#3d7bff" emissiveIntensity={1.4} wireframe toneMapped={false} />
        </mesh>
        <mesh geometry={GEO.sphere} scale={0.45}>
          <meshStandardMaterial color="#9dbbff" emissive="#5a90ff" emissiveIntensity={integrated ? 2.2 : 1.1} transparent opacity={0.85} toneMapped={false} />
        </mesh>
        <mesh ref={ring1} geometry={GEO.torus} material={MAT.neon("#22d3ee", 1.6)} rotation={[Math.PI / 2.4, 0, 0]} scale={[1.45, 1.45, 1]} />
        <mesh ref={ring2} geometry={GEO.torus} material={MAT.neon("#a78bfa", 1.2)} rotation={[Math.PI / 1.7, 0.4, 0]} scale={[1.25, 1.25, 1]} />
      </group>
      {/* light cone */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.35, 0.9, 1.3, 32, 1, true]} />
        <meshBasicMaterial color="#3d7bff" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 2.4, 0]} color="#4d86ff" intensity={16} distance={14} decay={2} />
      {/* four consoles around the core */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => (
        <group key={a} position={[Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4]} rotation={[0, a, 0]}>
          <Box material={MAT.dark()} position={[0, 0.55, 0]} size={[0.9, 0.9, 0.3]} />
          <Box material={MAT.screen("#3d7bff")} position={[0, 0.85, -0.16]} size={[0.8, 0.35, 0.01]} />
        </group>
      ))}
      <Html position={[0, 4.1, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="select-none whitespace-nowrap text-center">
          <div
            className="rounded-md border border-[#3d7bff]/60 bg-[#090c11]/80 px-3 py-1 text-[13px] font-bold tracking-[0.25em] text-[#9dbbff]"
            style={{ boxShadow: selected ? "0 0 22px #3d7bffaa" : undefined }}
          >
            CENTRAL BRAIN
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">{integrated ? "online" : "aguardando integração"}</div>
        </div>
      </Html>
    </group>
  );
}
