"use client";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import * as THREE from "three";
import { useOfficeStore } from "../store";
import type { OfficeSnapshot } from "../types";
import { INITIAL_POSITION } from "./OfficeCamera";
import { OfficeEffects } from "./OfficeEffects";
import { OfficeScene } from "./OfficeScene";

/**
 * WebGL canvas with two quality tiers. "high": soft shadows, ambient occlusion, bloom, character
 * animation. "low": no post-processing/shadows, lower pixel ratio. The tier drops automatically
 * when the frame rate is low (PerformanceMonitor) and can be toggled by the user.
 */
function isSoftwareRenderer(ctx: WebGLRenderingContext | WebGL2RenderingContext) {
  try {
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
    return /swiftshader|llvmpipe|software|softpipe|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

export default function VirtualOfficeCanvas({ snapshot }: { snapshot: OfficeSnapshot }) {
  const [dpr, setDpr] = useState(1.5);
  const quality = useOfficeStore((s) => s.quality);
  const setQuality = useOfficeStore((s) => s.setQuality);
  const select = useOfficeStore((s) => s.select);
  const high = quality === "high";

  return (
    <Canvas
      dpr={high ? dpr : 1}
      shadows={high ? "soft" : false}
      camera={{ position: INITIAL_POSITION.toArray(), fov: 34, near: 0.5, far: 260 }}
      gl={{ antialias: !high, powerPreference: "high-performance", toneMapping: high ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => select(null)}
      onCreated={({ gl }) => {
        // Software renderers (no GPU) cannot sustain the high tier: start in economy mode.
        if (isSoftwareRenderer(gl.getContext())) setQuality("low");
      }}
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
      <Suspense fallback={null}>
        <OfficeScene snapshot={snapshot} />
        {high && <OfficeEffects />}
      </Suspense>
    </Canvas>
  );
}
