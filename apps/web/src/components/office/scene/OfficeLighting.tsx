"use client";

/** Calm, readable lighting: cool ambient + soft key light. Accent lights live in each room. */
export function OfficeLighting({ shadows }: { shadows: boolean }) {
  return (
    <>
      <color attach="background" args={["#07090d"]} />
      <fog attach="fog" args={["#07090d", 55, 110]} />
      <ambientLight intensity={0.55} color="#b8c6e0" />
      <hemisphereLight args={["#9fb7ff", "#0a0d12", 0.55]} />
      <directionalLight
        position={[18, 28, 14]}
        intensity={1.25}
        color="#e8eeff"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <directionalLight position={[-20, 12, -10]} intensity={0.35} color="#3d7bff" />
    </>
  );
}
