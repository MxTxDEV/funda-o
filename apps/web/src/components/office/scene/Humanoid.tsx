"use client";
import type { OfficeStatus } from "@vc/core/client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ResolvedLook } from "./humanoid-look";
import { GEO, MAT } from "./shared";

/**
 * Procedural humanoid with an articulated skeleton (groups as bones): hips → spine → chest →
 * neck → head; chest → shoulders → elbows → wrists; hips → knees. Pose and motion are driven by
 * the employee's REAL status: only "executing" employees type/use the mouse.
 * Swap point: a licensed rigged GLB can replace this component keeping the same props.
 */
type Pose = "desk" | "sofa";

const torsoProfile = (fem: boolean) =>
  new THREE.LatheGeometry(
    (fem
      ? [
          [0, 0],
          [0.13, 0],
          [0.14, 0.05],
          [0.115, 0.15],
          [0.135, 0.25],
          [0.15, 0.32],
          [0.13, 0.38],
          [0.05, 0.41],
          [0, 0.41],
        ]
      : [
          [0, 0],
          [0.14, 0],
          [0.15, 0.05],
          [0.14, 0.15],
          [0.16, 0.25],
          [0.185, 0.32],
          [0.165, 0.38],
          [0.06, 0.42],
          [0, 0.42],
        ]
    ).map(([r, y]) => new THREE.Vector2(r, y)),
    28,
  );

const G = {
  torsoF: torsoProfile(true),
  torsoM: torsoProfile(false),
  hairCap: new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
  limb: new THREE.CapsuleGeometry(1, 1, 6, 12),
};

const UPPER_ARM = 0.27;
const FOREARM = 0.25;
const THIGH = 0.42;
const SHIN = 0.43;

function Limb({ length, radius, material, taper = 1 }: { length: number; radius: number; material: THREE.Material; taper?: number }) {
  // capsule hanging down from the joint (local -y)
  return <mesh geometry={G.limb} material={material} position={[0, -length / 2, 0]} scale={[radius * taper, length / 2 - radius, radius]} castShadow />;
}

export function Humanoid({
  look,
  status,
  phase,
  pose = "desk",
  animate,
  accent,
  detail = "high",
}: {
  look: ResolvedLook;
  status: OfficeStatus;
  phase: number;
  pose?: Pose;
  animate: boolean;
  accent: string;
  detail?: "high" | "low";
}) {
  const fem = look.body === "feminine";
  const skin = MAT.skin(look.skin);
  const hair = MAT.hair(look.hair);
  const jacketLike = look.outfit === "suit" || look.outfit === "blazer";
  const top = MAT.cloth(look.outfitColor);
  const shirt = MAT.cloth(jacketLike ? (look.outfit === "suit" ? "#f4f5f7" : "#dfe5ee") : look.outfitColor);
  const pants = MAT.cloth(look.outfit === "suit" ? look.outfitColor : fem ? "#2a2f3a" : "#262b35");
  const shoe = MAT.leather("#141414");
  const shoulderX = fem ? 0.165 : 0.19;

  const spine = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const uL = useRef<THREE.Group>(null);
  const uR = useRef<THREE.Group>(null);
  const fL = useRef<THREE.Group>(null);
  const fR = useRef<THREE.Group>(null);
  const hL = useRef<THREE.Group>(null);
  const hR = useRef<THREE.Group>(null);
  const mouseBlend = useRef(0);

  const base = useMemo(() => {
    if (pose === "sofa") return { spine: -0.28, uX: -0.25, fX: -1.1, uZ: 0.12 };
    if (status === "awaiting_approval") return { spine: -0.14, uX: -0.3, fX: -1.55, uZ: 0.28 }; // leaning back, arms folded
    if (status === "executing") return { spine: 0.1, uX: -0.62, fX: -0.92, uZ: 0.05 };
    return { spine: -0.04, uX: -0.42, fX: -1.15, uZ: 0.08 }; // relaxed, hands resting on the desk
  }, [pose, status]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + phase * 37;
    const s = spine.current;
    if (!s || !head.current || !uL.current || !uR.current || !fL.current || !fR.current) return;
    if (!animate) {
      s.rotation.x = base.spine;
      return;
    }
    const breathe = Math.sin(t * 1.6) * 0.012;
    s.rotation.x = base.spine + breathe;
    if (chest.current) chest.current.scale.set(1, 1 + breathe * 0.8, 1 + breathe);

    if (status === "executing" && pose === "desk") {
      // Mouse usage in periodic windows, typing otherwise (different rhythm per employee).
      const mouseWindow = Math.sin(t * 0.21 + phase * 6) > 0.55 ? 1 : 0;
      mouseBlend.current += (mouseWindow - mouseBlend.current) * Math.min(1, delta * 3);
      const m = mouseBlend.current;
      const typeL = Math.sin(t * (9 + phase * 3)) * 0.05;
      const typeR = Math.sin(t * (10 + phase * 2) + 1.7) * 0.05 * (1 - m);
      uL.current.rotation.set(base.uX + typeL * 0.3, 0, base.uZ);
      fL.current.rotation.x = base.fX + typeL;
      uR.current.rotation.set(base.uX - 0.05 * m + typeR * 0.3, 0, -base.uZ - 0.32 * m);
      fR.current.rotation.x = base.fX + typeR + Math.sin(t * 2.3) * 0.02 * m;
      if (hR.current) hR.current.rotation.z = -0.25 * m;
      // Looks at the screen with small nods and an occasional glance aside.
      const glance = Math.max(0, Math.sin(t * 0.13 + phase * 9) - 0.9) * 4;
      head.current.rotation.set(0.12 + Math.sin(t * 0.7) * 0.03, glance * 0.45 * (phase > 0.5 ? 1 : -1), 0);
    } else {
      const look = Math.sin(t * 0.25 + phase * 5);
      head.current.rotation.set(pose === "sofa" ? 0.05 : 0.02 + Math.sin(t * 0.4) * 0.03, look * 0.5, pose === "sofa" ? 0.12 : look * 0.04);
      uL.current.rotation.set(base.uX, 0, base.uZ);
      uR.current.rotation.set(base.uX, 0, -base.uZ);
      fL.current.rotation.x = base.fX;
      fR.current.rotation.x = base.fX;
    }
  });

  const hips: [number, number, number] = pose === "sofa" ? [0, 0.5, -0.02] : [0, 0.53, -0.04];

  return (
    <group position={hips}>
      {/* pelvis */}
      <mesh geometry={GEO.sphere} material={pants} scale={[fem ? 0.155 : 0.15, 0.1, 0.12]} castShadow />
      {/* legs: thighs forward, shins down */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.085, -0.01, 0]} rotation={[-Math.PI / 2 + (pose === "sofa" ? 0.12 : 0), 0, side * 0.03]}>
          <Limb length={THIGH} radius={0.068} material={pants} />
          <group position={[0, -THIGH, 0]} rotation={[Math.PI / 2 - (pose === "sofa" ? 0.25 : 0.05), 0, 0]}>
            <Limb length={SHIN} radius={0.055} material={pants} />
            <mesh geometry={GEO.roundBox} material={shoe} position={[0, -SHIN - 0.02, 0.05]} scale={[0.09, 0.07, 0.24]} castShadow />
          </group>
        </group>
      ))}
      <group ref={spine} position={[0, 0.04, 0]}>
        <group ref={chest}>
          <mesh geometry={fem ? G.torsoF : G.torsoM} material={top} scale={[1, 1, 0.66]} castShadow />
          {detail === "high" && (
            <>
              {jacketLike && (
                <>
                  {/* shirt V + lapels */}
                  <mesh geometry={GEO.box} material={shirt} position={[0, 0.33, 0.095]} rotation={[-0.2, 0, 0]} scale={[0.07, 0.15, 0.01]} />
                  <mesh geometry={GEO.box} material={MAT.cloth(look.outfitColor)} position={[-0.05, 0.31, 0.1]} rotation={[-0.2, 0, -0.35]} scale={[0.035, 0.17, 0.012]} />
                  <mesh geometry={GEO.box} material={MAT.cloth(look.outfitColor)} position={[0.05, 0.31, 0.1]} rotation={[-0.2, 0, 0.35]} scale={[0.035, 0.17, 0.012]} />
                  {look.tie && <mesh geometry={GEO.box} material={MAT.cloth("#0f1420")} position={[0, 0.3, 0.103]} rotation={[-0.2, 0, 0]} scale={[0.026, 0.15, 0.008]} />}
                  {/* buttons */}
                  <mesh geometry={GEO.sphere} material={MAT.blackMetal()} position={[0, 0.17, 0.1]} scale={0.008} />
                </>
              )}
              {(look.outfit === "shirt" || look.outfit === "polo") && (
                <mesh geometry={GEO.torus} material={shirt} position={[0, 0.405, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.065, 0.06, 3]} />
              )}
              {look.outfit === "sweater" && <mesh geometry={GEO.torus} material={top} position={[0, 0.41, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.058, 0.052, 4]} />}
              {/* department badge (accent color) */}
              {!jacketLike && (
                <>
                  <mesh geometry={GEO.box} material={MAT.cloth(accent)} position={[0.075, 0.26, 0.1]} scale={[0.04, 0.055, 0.006]} />
                </>
              )}
              {jacketLike && <mesh geometry={GEO.box} material={MAT.emissive(accent, 0.8)} position={[-0.08, 0.3, 0.104]} rotation={[-0.2, 0, 0]} scale={[0.018, 0.008, 0.004]} />}
            </>
          )}
          {/* neck + head */}
          <mesh geometry={G.limb} material={skin} position={[0, 0.45, 0.005]} scale={[0.045, 0.03, 0.045]} />
          <group ref={head} position={[0, 0.49, 0.01]}>
            <mesh geometry={GEO.sphere} material={skin} position={[0, 0.11, 0]} scale={[0.1, 0.122, 0.112]} castShadow />
            {detail === "high" && (
              <>
                {/* ears, nose, eyes, brows, mouth */}
                <mesh geometry={GEO.sphere} material={skin} position={[-0.1, 0.105, -0.005]} scale={[0.018, 0.03, 0.02]} />
                <mesh geometry={GEO.sphere} material={skin} position={[0.1, 0.105, -0.005]} scale={[0.018, 0.03, 0.02]} />
                <mesh geometry={GEO.sphere} material={skin} position={[0, 0.095, 0.112]} scale={[0.016, 0.022, 0.02]} />
                {[-1, 1].map((sx) => (
                  <group key={sx}>
                    <mesh geometry={GEO.sphere} material={MAT.eye()} position={[sx * 0.036, 0.122, 0.096]} scale={[0.016, 0.012, 0.01]} />
                    <mesh geometry={GEO.sphere} material={MAT.pupil()} position={[sx * 0.036, 0.122, 0.104]} scale={[0.008, 0.008, 0.004]} />
                    <mesh geometry={GEO.box} material={hair} position={[sx * 0.036, 0.148, 0.1]} rotation={[0, 0, sx * -0.12]} scale={[0.03, 0.006, 0.006]} />
                  </group>
                ))}
                <mesh geometry={GEO.box} material={MAT.cloth(fem ? "#9c4a4a" : "#7a4a3a")} position={[0, 0.06, 0.105]} scale={[0.032, 0.006, 0.006]} />
                {look.glasses && (
                  <group position={[0, 0.122, 0.108]}>
                    <mesh geometry={GEO.torus} material={MAT.blackMetal()} position={[-0.036, 0, 0]} scale={[0.024, 0.02, 1.2]} />
                    <mesh geometry={GEO.torus} material={MAT.blackMetal()} position={[0.036, 0, 0]} scale={[0.024, 0.02, 1.2]} />
                    <mesh geometry={GEO.box} material={MAT.blackMetal()} position={[0, 0.002, 0]} scale={[0.024, 0.004, 0.004]} />
                  </group>
                )}
                {look.beard && <mesh geometry={G.hairCap} material={hair} position={[0, 0.085, 0.02]} rotation={[Math.PI, 0, 0]} scale={[0.098, 0.07, 0.102]} />}
              </>
            )}
            <Hair look={look} material={hair} detail={detail} />
          </group>
          {/* arms */}
          {(
            [
              [-1, uL, fL, hL],
              [1, uR, fR, hR],
            ] as const
          ).map(([side, u, f, h]) => (
            <group key={side} position={[side * shoulderX, 0.36, 0]}>
              <mesh geometry={GEO.sphere} material={top} scale={0.062} castShadow />
              <group ref={u} rotation={[base.uX, 0, side * base.uZ]}>
                <Limb length={UPPER_ARM} radius={0.05} material={top} />
                <group ref={f} position={[0, -UPPER_ARM, 0]} rotation={[base.fX, 0, 0]}>
                  <Limb length={FOREARM} radius={0.043} material={top} />
                  {jacketLike && <mesh geometry={G.limb} material={shirt} position={[0, -FOREARM + 0.01, 0]} scale={[0.04, 0.008, 0.04]} />}
                  <group ref={h} position={[0, -FOREARM - 0.02, 0]}>
                    <mesh geometry={GEO.roundBox} material={skin} position={[0, -0.04, 0]} scale={[0.05, 0.085, 0.024]} />
                    {detail === "high" && <mesh geometry={G.limb} material={skin} position={[side * -0.03, -0.03, 0.012]} rotation={[0, 0, side * 0.6]} scale={[0.011, 0.012, 0.011]} />}
                  </group>
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function Hair({ look, material, detail }: { look: ResolvedLook; material: THREE.Material; detail: "high" | "low" }) {
  const cap = <mesh geometry={G.hairCap} material={material} position={[0, 0.115, -0.006]} scale={[0.108, 0.13, 0.12]} castShadow />;
  switch (look.hairStyle) {
    case "bald":
      return null;
    case "short":
      return cap;
    case "side":
      return (
        <>
          {cap}
          <mesh geometry={GEO.sphere} material={material} position={[-0.03, 0.215, 0.03]} scale={[0.08, 0.035, 0.07]} />
        </>
      );
    case "long":
      return (
        <>
          {cap}
          <mesh geometry={GEO.roundBox} material={material} position={[0, 0.02, -0.06]} scale={[0.22, 0.26, 0.09]} castShadow />
          <mesh geometry={GEO.roundBox} material={material} position={[-0.095, 0.06, 0.02]} scale={[0.035, 0.2, 0.08]} />
          <mesh geometry={GEO.roundBox} material={material} position={[0.095, 0.06, 0.02]} scale={[0.035, 0.2, 0.08]} />
        </>
      );
    case "bun":
      return (
        <>
          {cap}
          <mesh geometry={GEO.sphere} material={material} position={[0, 0.2, -0.09]} scale={0.055} />
        </>
      );
    case "ponytail":
      return (
        <>
          {cap}
          <mesh geometry={GEO.sphere} material={material} position={[0, 0.16, -0.12]} scale={0.035} />
          <mesh geometry={G.limb} material={material} position={[0, 0.06, -0.14]} rotation={[0.25, 0, 0]} scale={[0.03, 0.08, 0.03]} />
        </>
      );
    case "curly":
      return (
        <>
          {cap}
          {detail === "high" &&
            Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const y = 0.16 + (i % 3) * 0.035;
              return <mesh key={i} geometry={GEO.sphere} material={material} position={[Math.sin(a) * 0.095, y, Math.cos(a) * 0.09 - 0.02]} scale={0.04} />;
            })}
        </>
      );
    default:
      return cap;
  }
}
