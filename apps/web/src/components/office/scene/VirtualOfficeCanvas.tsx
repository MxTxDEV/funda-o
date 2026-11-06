"use client";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { useOfficeStore } from "../store";
import type { OfficeSnapshot } from "../types";
import { INITIAL_POSITION } from "./OfficeCamera";
import { OfficeScene } from "./OfficeScene";

/**
 * WebGL canvas. Quality adapts automatically: if the frame rate drops, the pixel ratio is lowered
 * and character/core animations are disabled (store.quality = "low").
 */
export default function VirtualOfficeCanvas({ snapshot }: { snapshot: OfficeSnapshot }) {
  const [dpr, setDpr] = useState(1.5);
  const quality = useOfficeStore((s) => s.quality);
  const setQuality = useOfficeStore((s) => s.setQuality);
  const select = useOfficeStore((s) => s.select);

  return (
    <Canvas
      dpr={dpr}
      shadows={quality === "high"}
      camera={{ position: INITIAL_POSITION.toArray(), fov: 38, near: 0.5, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => select(null)}
      data-testid="office-canvas"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setQuality("low");
        }}
        onIncline={() => setDpr(1.5)}
      />
      <AdaptiveDpr pixelated={false} />
      <OfficeScene snapshot={snapshot} shadows={quality === "high"} />
    </Canvas>
  );
}
