import type { AgentAppearance } from "@vc/db";

export type ResolvedLook = Required<Omit<AgentAppearance, "glasses" | "beard" | "tie">> & { glasses: boolean; beard: boolean; tie: boolean };

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SKIN = ["#f2d3b1", "#e0b48f", "#c68a5e", "#a8693f", "#7a4a2a", "#5a3520"];
const HAIR = ["#1d1b1a", "#3b2a20", "#6b4a2b", "#b07a3c", "#d9c08a", "#8a8f99"];
const OUTFIT = ["#1b2230", "#24324d", "#3a4a63", "#2b2f45", "#e2e8f0", "#374151", "#0f5c66"];
const STYLES_F: ResolvedLook["hairStyle"][] = ["long", "bun", "ponytail", "curly"];
const STYLES_M: ResolvedLook["hairStyle"][] = ["short", "side", "curly", "bald"];
const OUTFITS: ResolvedLook["outfit"][] = ["blazer", "shirt", "sweater", "polo"];

/** Final look: explicit appearance from the database, missing fields derived from the avatar seed. */
export function resolveLook(seed: string, a: AgentAppearance | null | undefined): ResolvedLook {
  const h = hash(seed);
  const body = a?.body ?? (h & 1 ? "feminine" : "masculine");
  return {
    body,
    skin: a?.skin ?? SKIN[(h >>> 2) % SKIN.length]!,
    hair: a?.hair ?? HAIR[(h >>> 5) % HAIR.length]!,
    hairStyle: a?.hairStyle ?? (body === "feminine" ? STYLES_F : STYLES_M)[(h >>> 8) % 4]!,
    outfit: a?.outfit ?? OUTFITS[(h >>> 11) % OUTFITS.length]!,
    outfitColor: a?.outfitColor ?? OUTFIT[(h >>> 14) % OUTFIT.length]!,
    glasses: a?.glasses ?? ((h >>> 17) & 3) === 0,
    beard: a?.beard ?? (body === "masculine" && ((h >>> 19) & 3) === 1),
    tie: a?.tie ?? false,
  };
}

export function phaseOf(id: string) {
  return (hash(id) % 1000) / 1000;
}
