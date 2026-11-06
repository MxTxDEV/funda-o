"use client";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ROOM_CENTERS } from "../layout";
import { useOfficeStore } from "../store";
import type { Vec3 } from "../types";
import { Box } from "./primitives";
import { GEO, MAT } from "./shared";

export type BrainLink = { zone: string; target: Vec3; color: string; activity: number };

/** Point cloud shaped like a brain: two hemispheres with folded (gyri-like) surface. */
function brainPoints(count: number) {
  const pts = new Float32Array(count * 3);
  let s = 12345;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const u = r() * Math.PI * 2;
    const v = Math.acos(2 * r() - 1);
    const side = i % 2 ? 1 : -1;
    const fold = 1 + 0.08 * Math.sin(u * 7 + v * 5) * Math.sin(v * 9);
    const depth = 0.82 + r() * 0.18; // mostly near the surface
    let x = Math.sin(v) * Math.cos(u) * 0.48 * fold * depth;
    const y = Math.cos(v) * 0.42 * fold * depth;
    const z = Math.sin(v) * Math.sin(u) * 0.62 * fold * depth;
    x = Math.abs(x) * side + side * 0.05; // longitudinal fissure
    pts.set([x, y * (y < 0 ? 0.75 : 1), z], i * 3);
  }
  return pts;
}

function risingParticles(count: number) {
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.8;
    pts.set([Math.cos(a) * rad, Math.random() * 3.2, Math.sin(a) * rad], i * 3);
  }
  return pts;
}

/**
 * Central Brain — the company's core. Platform, glass column, holographic brain, orbit rings,
 * rising particles, department nodes and data links. Animation intensity follows REAL activity
 * (tasks executing); links pulse only for departments currently executing work.
 */
export function CentralBrainObject({ activity, integrated, links }: { activity: number; integrated: boolean; links: BrainLink[] }) {
  const [cx, , cz] = ROOM_CENTERS.brain;
  const selected = useOfficeStore((s) => s.selection?.kind === "room" && s.selection.id === "brain");
  const quality = useOfficeStore((s) => s.quality);
  const select = useOfficeStore((s) => s.select);
  const brain = useRef<THREE.Points>(null);
  const shell = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Points>(null);
  const light = useRef<THREE.PointLight>(null);
  const high = quality === "high";

  const brainGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(brainPoints(high ? 4200 : 1800), 3));
    return g;
  }, [high]);
  const particleGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(risingParticles(high ? 260 : 80), 3));
    return g;
  }, [high]);

  const speed = 0.15 + activity * 0.9;
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (brain.current) {
      brain.current.rotation.y += delta * speed * 0.6;
      const m = brain.current.material as THREE.PointsMaterial;
      m.opacity = 0.75 + Math.sin(t * (1.2 + activity * 3)) * 0.12;
    }
    if (shell.current) shell.current.rotation.y -= delta * speed * 0.25;
    if (rings.current) {
      rings.current.children.forEach((ring, i) => {
        ring.rotation.z += delta * speed * (i % 2 ? -0.7 : 0.5);
      });
    }
    if (particles.current && high) {
      const pos = particles.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + delta * (0.25 + activity * 0.9);
        if (y > 3.2) y = 0;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (light.current) light.current.intensity = 6 + activity * 10 + Math.sin(t * 2) * 1.5;
  });

  const onSelect = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select({ kind: "room", id: "brain" });
  };

  return (
    <group>
      <group
        position={[cx, 0, cz]}
        onClick={onSelect}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {/* tiered platform */}
        <mesh geometry={GEO.cylinder} position={[0, 0.04, 0]} scale={[3.7, 0.08, 3.7]} receiveShadow>
          <meshStandardMaterial color="#14181f" roughness={0.32} metalness={0.6} />
        </mesh>
        <mesh geometry={GEO.cylinder} position={[0, 0.14, 0]} scale={[3.0, 0.12, 3.0]} receiveShadow castShadow>
          <meshStandardMaterial color="#1a1f28" roughness={0.28} metalness={0.7} />
        </mesh>
        <mesh geometry={GEO.cylinder} position={[0, 0.26, 0]} scale={[2.2, 0.12, 2.2]} receiveShadow castShadow>
          <meshStandardMaterial color="#20262f" roughness={0.25} metalness={0.75} />
        </mesh>
        {[3.7, 3.0, 2.2].map((r, i) => (
          <mesh key={r} geometry={GEO.torus} material={MAT.emissive(i === 1 ? "#22d3ee" : "#3d7bff", selected ? 2.2 : 1.2)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.085 + i * 0.12, 0]} scale={[r, r, 0.8]} />
        ))}
        {/* glass railing */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[3.0, 3.0, 0.9, 64, 1, true]} />
          <primitive object={MAT.glass()} attach="material" />
        </mesh>
        <mesh geometry={GEO.torus} material={MAT.aluminium()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.07, 0]} scale={[3.0, 3.0, 2]} />
        {/* pedestal with vertical light strips */}
        <mesh geometry={GEO.cylinder} position={[0, 0.75, 0]} scale={[0.75, 0.9, 0.75]} castShadow>
          <meshStandardMaterial color="#0f1217" roughness={0.3} metalness={0.85} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <Box key={i} material={MAT.emissive("#3d7bff", 1.4)} position={[Math.sin(a) * 0.76, 0.75, Math.cos(a) * 0.76]} size={[0.025, 0.8, 0.025]} />;
        })}
        {/* glass column + cap */}
        <mesh position={[0, 2.8, 0]}>
          <cylinderGeometry args={[0.95, 0.95, 3.2, 48, 1, true]} />
          <meshPhysicalMaterial color="#9dbbff" transparent opacity={0.1} roughness={0.05} metalness={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh geometry={GEO.torus} material={MAT.aluminium()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.2, 0]} scale={[0.95, 0.95, 3]} />
        <mesh geometry={GEO.torus} material={MAT.emissive("#5a90ff", 1.6)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.4, 0]} scale={[0.95, 0.95, 3]} />
        <mesh geometry={GEO.cylinder} position={[0, 4.45, 0]} scale={[1.05, 0.08, 1.05]}>
          <meshStandardMaterial color="#12161d" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* holographic brain */}
        <group position={[0, 2.75, 0]}>
          <points ref={brain} geometry={brainGeo}>
            <pointsMaterial color="#7fb0ff" size={0.028} sizeAttenuation transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </points>
          <mesh ref={shell} geometry={GEO.ico} scale={0.78}>
            <meshBasicMaterial color="#3d7bff" wireframe transparent opacity={0.12} toneMapped={false} />
          </mesh>
          <mesh geometry={GEO.sphere} scale={0.16}>
            <meshBasicMaterial color={integrated ? "#cfe0ff" : "#6f95e6"} toneMapped={false} />
          </mesh>
          <group ref={rings}>
            <mesh geometry={GEO.torus} material={MAT.emissive("#22d3ee", 1.4)} rotation={[Math.PI / 2.3, 0, 0]} scale={[0.92, 0.92, 1]} />
            <mesh geometry={GEO.torus} material={MAT.emissive("#3d7bff", 1.2)} rotation={[Math.PI / 1.8, 0.5, 0]} scale={[0.82, 0.82, 1]} />
            <mesh geometry={GEO.torus} material={MAT.emissive("#a78bfa", 0.9)} rotation={[0.3, 0, Math.PI / 3]} scale={[0.72, 0.72, 1]} />
          </group>
        </group>
        <points ref={particles} geometry={particleGeo} position={[0, 1.2, 0]}>
          <pointsMaterial color="#9dbbff" size={0.035} sizeAttenuation transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
        <pointLight ref={light} position={[0, 2.7, 0]} color="#4d86ff" intensity={8} distance={12} decay={2} />
        {/* department nodes around the platform */}
        {links.map((l) => {
          const dir = new THREE.Vector2(l.target[0] - cx, l.target[2] - cz).normalize();
          return (
            <group key={l.zone} position={[dir.x * 3.35, 0, dir.y * 3.35]}>
              <Box material={MAT.blackMetal()} position={[0, 0.35, 0]} size={[0.16, 0.7, 0.16]} />
              <Box material={MAT.emissive(l.color, 0.6 + l.activity * 2.4)} position={[0, 0.74, 0]} size={[0.2, 0.06, 0.2]} />
            </group>
          );
        })}
        <Html position={[0, 5.05, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="select-none whitespace-nowrap text-center">
            <div className="rounded-md border border-[#3d7bff]/60 bg-[#090c11]/80 px-3 py-1 text-[12px] font-bold tracking-[0.3em] text-[#9dbbff]" style={{ boxShadow: selected ? "0 0 22px #3d7bffaa" : undefined }}>
              CENTRAL BRAIN
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-400">{integrated ? "online" : "aguardando integração de IA"}</div>
          </div>
        </Html>
      </group>
      {links.map((l) => (
        <DataLink key={l.zone} from={[cx, 4.3, cz]} to={[l.target[0], 2.75, l.target[2]]} color={l.color} activity={l.activity} animate={high} />
      ))}
    </group>
  );
}

/** Arc from the core to a department. Pulses travel along it only while that department executes tasks. */
function DataLink({ from, to, color, activity, animate }: { from: Vec3; to: Vec3; color: string; activity: number; animate: boolean }) {
  const curve = useMemo(() => {
    const mid = new THREE.Vector3((from[0] + to[0]) / 2, Math.max(from[1], to[1]) + 2.2, (from[2] + to[2]) / 2);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), mid, new THREE.Vector3(...to));
  }, [from, to]);
  const points = useMemo(() => curve.getPoints(40), [curve]);
  const pulses = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!pulses.current || activity === 0 || !animate) return;
    pulses.current.children.forEach((p, i) => {
      const t = (clock.elapsedTime * 0.35 + i / pulses.current!.children.length) % 1;
      p.position.copy(curve.getPoint(t));
    });
  });
  return (
    <group>
      <Line points={points} color={color} lineWidth={activity > 0 ? 1.6 : 0.8} transparent opacity={activity > 0 ? 0.65 : 0.16} />
      {activity > 0 && (
        <group ref={pulses}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={GEO.sphere} material={MAT.emissive(color, 3)} scale={0.06} />
          ))}
        </group>
      )}
    </group>
  );
}
