import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { carpetTexture, concreteTexture, fabricTexture, slatTexture, woodTexture } from "./textures";

/**
 * Shared geometries and PBR materials (created once, reused by every instance).
 * To use professional assets later, swap the furniture kits in furniture.ts and the
 * character body in Humanoid.tsx — scene composition and data flow stay the same.
 */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  roundBox: new RoundedBoxGeometry(1, 1, 1, 3, 0.08),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 32),
  sphere: new THREE.SphereGeometry(1, 24, 16),
  capsule: new THREE.CapsuleGeometry(1, 1, 8, 16),
  ring: new THREE.RingGeometry(0.42, 0.5, 48),
  torus: new THREE.TorusGeometry(1, 0.02, 8, 128),
  ico: new THREE.IcosahedronGeometry(1, 2),
};

const cache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

const std = (key: string, params: THREE.MeshStandardMaterialParameters) => cached(key, () => new THREE.MeshStandardMaterial(params));

export const MAT = {
  // Architecture
  concrete: () => {
    const map = concreteTexture().clone();
    map.repeat.set(10, 8);
    map.needsUpdate = true;
    return std("concrete", { map, color: "#8a9099", roughness: 0.62, metalness: 0.05 });
  },
  woodFloor: (tone: "oak" | "walnut" | "ash" = "oak") => {
    const map = woodTexture(tone, true).clone();
    map.repeat.set(3, 3);
    map.needsUpdate = true;
    return std(`woodFloor:${tone}`, { map, roughness: 0.55, metalness: 0.02 });
  },
  carpet: (color = "#2a3142") => {
    const map = carpetTexture(color).clone();
    map.repeat.set(6, 4);
    map.needsUpdate = true;
    return std(`carpet:${color}`, { map, roughness: 0.95, metalness: 0 });
  },
  wall: () => std("wall", { color: "#d9dce1", roughness: 0.9, metalness: 0 }),
  wallDark: () => std("wallDark", { color: "#1b2029", roughness: 0.85, metalness: 0.05 }),
  slats: (tone = "#6b4f36") => {
    const map = slatTexture(tone).clone();
    map.repeat.set(3, 1);
    map.needsUpdate = true;
    return std(`slats:${tone}`, { map, roughness: 0.7 });
  },
  glass: () =>
    cached("glass", () => new THREE.MeshPhysicalMaterial({ color: "#c9d8ff", transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide })),
  aluminium: () => std("aluminium", { color: "#aeb5bf", roughness: 0.32, metalness: 0.9 }),
  blackMetal: () => std("blackMetal", { color: "#1c1f25", roughness: 0.4, metalness: 0.75 }),
  chrome: () => std("chrome", { color: "#d4d9e0", roughness: 0.15, metalness: 1 }),
  // Furniture
  wood: (tone: "oak" | "walnut" | "ash" = "oak") => std(`wood:${tone}`, { map: woodTexture(tone, false), roughness: 0.45, metalness: 0.02 }),
  laminateWhite: () => std("laminateWhite", { color: "#eceef1", roughness: 0.4, metalness: 0 }),
  plasticDark: () => std("plasticDark", { color: "#15181d", roughness: 0.5, metalness: 0.1 }),
  plasticLight: () => std("plasticLight", { color: "#d7dbe1", roughness: 0.45, metalness: 0 }),
  mesh: () => std("mesh", { color: "#22272f", roughness: 0.9, metalness: 0, transparent: true, opacity: 0.94 }),
  fabric: (color: string) => std(`fabric:${color}`, { map: fabricTexture(color), roughness: 0.95, metalness: 0 }),
  leather: (color: string) => std(`leather:${color}`, { color, roughness: 0.55, metalness: 0 }),
  ceramic: (color = "#e9e6df") => std(`ceramic:${color}`, { color, roughness: 0.35 }),
  leaf: (color = "#2f6b3f") => std(`leaf:${color}`, { color, roughness: 0.75, side: THREE.DoubleSide }),
  soil: () => std("soil", { color: "#2b2118", roughness: 1 }),
  paper: (color: string) => std(`paper:${color}`, { color, roughness: 0.85 }),
  solid: (color: string, roughness = 0.6) => std(`solid:${color}:${roughness}`, { color, roughness, metalness: 0.05 }),
  // Light / accents (used sparingly)
  emissive: (color: string, intensity = 1) =>
    std(`emissive:${color}:${intensity}`, { color: "#000000", emissive: color, emissiveIntensity: intensity, toneMapped: false }),
  lightPanel: () => std("lightPanel", { color: "#ffffff", emissive: "#f4f6ff", emissiveIntensity: 1.6, toneMapped: false }),
  basic: (color: string) => cached(`basic:${color}`, () => new THREE.MeshBasicMaterial({ color, toneMapped: false })),
  textured: (key: string, map: THREE.Texture, emissive = false) =>
    cached(`tex:${key}`, () =>
      emissive
        ? new THREE.MeshBasicMaterial({ map, toneMapped: false })
        : new THREE.MeshStandardMaterial({ map, roughness: 0.6, transparent: true }),
    ),
  // Characters
  skin: (color: string) => std(`skin:${color}`, { color, roughness: 0.62, metalness: 0 }),
  cloth: (color: string) => std(`cloth:${color}`, { color, roughness: 0.85, metalness: 0 }),
  hair: (color: string) => std(`hair:${color}`, { color, roughness: 0.55, metalness: 0.05 }),
  eye: () => std("eye", { color: "#f5f5f2", roughness: 0.3 }),
  pupil: () => std("pupil", { color: "#1a1410", roughness: 0.2 }),
};
