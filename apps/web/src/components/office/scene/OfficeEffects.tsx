"use client";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/** Post-processing for the high quality tier only: ambient occlusion, subtle bloom, AA, filmic tone mapping. */
export function OfficeEffects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={1.1} distanceFalloff={0.8} intensity={2.4} quality="medium" halfRes />
      <Bloom luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.45} mipmapBlur />
      <SMAA />
      <Vignette offset={0.25} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
