"use client";
import { Environment, Lightformer } from "@react-three/drei";

/**
 * Lighting: a locally generated environment map (virtual softboxes, no HDR download) gives
 * physically based reflections; one key light casts soft shadows; neon is only an accent.
 */
export function OfficeLighting({ shadows, high }: { shadows: boolean; high: boolean }) {
  return (
    <>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#07090d", 75, 150]} />
      <Environment resolution={high ? 256 : 64} frames={1} environmentIntensity={0.85}>
        <color attach="background" args={["#0a0d13"]} />
        {/* ceiling light panels */}
        {[-14, 0, 14].flatMap((x) =>
          [-10, 0, 10].map((z) => <Lightformer key={`${x}:${z}`} form="rect" intensity={1.6} color="#ffffff" position={[x, 8, z]} rotation-x={Math.PI / 2} scale={[8, 5, 1]} />),
        )}
        {/* window light (back/left) and warm fill (front) */}
        <Lightformer form="rect" intensity={1.4} color="#b9ccff" position={[0, 3, -30]} scale={[60, 4, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#b9ccff" position={[-30, 3, 0]} rotation-y={Math.PI / 2} scale={[40, 4, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffe2c4" position={[20, 4, 25]} rotation-y={-Math.PI / 4} scale={[30, 6, 1]} />
        <Lightformer form="ring" intensity={2.5} color="#3d7bff" position={[0, 6, 0]} scale={3} rotation-x={Math.PI / 2} />
      </Environment>
      <ambientLight intensity={0.18} color="#c9d4ea" />
      <hemisphereLight args={["#d6e1ff", "#0d1015", 0.35]} />
      <directionalLight
        position={[18, 32, 22]}
        intensity={1.9}
        color="#fff6ea"
        castShadow={shadows}
        shadow-mapSize={high ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={5}
        shadow-camera-far={80}
      />
      <directionalLight position={[-24, 14, -12]} intensity={0.35} color="#7f9cff" />
    </>
  );
}
