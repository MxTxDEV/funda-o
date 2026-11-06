"use client";
import { HIERARCHY_LABELS, OFFICE_STATUS_COLORS, OFFICE_STATUS_LABELS } from "@vc/core/client";
import { Detailed, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { useOfficeStore } from "../store";
import type { OfficeAgent, Vec3 } from "../types";
import { Humanoid } from "./Humanoid";
import { phaseOf, resolveLook } from "./humanoid-look";
import { GEO, MAT } from "./shared";

/**
 * A real employee in the office. Clicking selects it (never runs any action).
 * Level of detail: full humanoid up close, simplified body far away.
 */
export function EmployeeCharacter({
  agent,
  position,
  rotationY,
  onSofa = false,
  accent,
  departmentName,
}: {
  agent: OfficeAgent;
  position: Vec3;
  rotationY: number;
  onSofa?: boolean;
  accent: string;
  departmentName?: string;
}) {
  const look = useMemo(() => resolveLook(agent.avatarSeed, agent.appearance), [agent.avatarSeed, agent.appearance]);
  const phase = phaseOf(agent.id);
  const color = OFFICE_STATUS_COLORS[agent.officeStatus];
  const selected = useOfficeStore((s) => s.selection?.kind === "agent" && s.selection.id === agent.id);
  const hovered = useOfficeStore((s) => s.hovered === agent.id);
  const animate = useOfficeStore((s) => s.quality === "high");
  const select = useOfficeStore((s) => s.select);
  const setHovered = useOfficeStore((s) => s.setHovered);
  const dot = useRef<THREE.Mesh>(null);
  const executing = agent.officeStatus === "executing";
  const pose = onSofa ? "sofa" : "desk";

  useFrame(({ clock }) => {
    if (!dot.current || !animate) return;
    const t = clock.elapsedTime + phase * 10;
    dot.current.position.y = 1.62 + Math.sin(t * 1.8) * 0.025;
    dot.current.scale.setScalar(executing ? 0.035 + Math.sin(t * 5) * 0.008 : 0.03);
  });

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
      {/* soft status halo on the floor */}
      <mesh geometry={GEO.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={selected || hovered ? 1.45 : 1.2}>
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.95 : 0.55} toneMapped={false} depthWrite={false} />
      </mesh>
      <Detailed distances={[0, 34]}>
        <Humanoid look={look} status={agent.officeStatus} phase={phase} pose={pose} animate={animate} accent={accent} detail="high" />
        <Humanoid look={look} status={agent.officeStatus} phase={phase} pose={pose} animate={false} accent={accent} detail="low" />
      </Detailed>
      <mesh ref={dot} geometry={GEO.sphere} material={MAT.emissive(color, 2.2)} position={[0, 1.62, 0]} scale={0.03} />
      {(hovered || selected) && (
        <Html position={[0, 1.85, 0]} center zIndexRange={[40, 20]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md border border-white/10 bg-[#0b0f16]/92 px-2.5 py-1.5 text-center shadow-xl">
            <div className="text-[12px] font-semibold text-white">{agent.name}</div>
            <div className="text-[11px] text-slate-300">{agent.title}</div>
            <div className="text-[10px] text-slate-500">
              {HIERARCHY_LABELS[agent.hierarchyLevel]}
              {departmentName ? ` · ${departmentName}` : ""}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color }}>
              {OFFICE_STATUS_LABELS[agent.officeStatus]}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
