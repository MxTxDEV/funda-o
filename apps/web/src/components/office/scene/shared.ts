import * as THREE from "three";

/**
 * Geometries and materials shared by every instance in the scene (created once per page load).
 * Replace these with professional assets later without touching the components that use them.
 */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 32),
  sphere: new THREE.SphereGeometry(1, 20, 16),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 12),
  ring: new THREE.RingGeometry(0.42, 0.5, 40),
  torus: new THREE.TorusGeometry(1, 0.025, 8, 96),
  ico: new THREE.IcosahedronGeometry(1, 1),
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

export const MAT = {
  floor: () => cached("floor", () => new THREE.MeshStandardMaterial({ color: "#0c1017", roughness: 0.85, metalness: 0.15 })),
  roomFloor: (color: string) =>
    cached(`roomFloor:${color}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.08).add(new THREE.Color("#10151d")), roughness: 0.7, metalness: 0.2 })),
  glass: () =>
    cached("glass", () => new THREE.MeshStandardMaterial({ color: "#7aa2ff", transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide })),
  wall: () => cached("wall", () => new THREE.MeshStandardMaterial({ color: "#161c27", roughness: 0.8, metalness: 0.1 })),
  neon: (color: string, intensity = 1.2) =>
    cached(`neon:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, toneMapped: false })),
  deskTop: () => cached("deskTop", () => new THREE.MeshStandardMaterial({ color: "#e8ecf2", roughness: 0.35, metalness: 0.05 })),
  deskLeg: () => cached("deskLeg", () => new THREE.MeshStandardMaterial({ color: "#2a3140", roughness: 0.4, metalness: 0.7 })),
  dark: () => cached("dark", () => new THREE.MeshStandardMaterial({ color: "#0e1219", roughness: 0.5, metalness: 0.4 })),
  chair: () => cached("chair", () => new THREE.MeshStandardMaterial({ color: "#1d2533", roughness: 0.6, metalness: 0.2 })),
  screenOff: () => cached("screenOff", () => new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.2, metalness: 0.3 })),
  screen: (color: string) =>
    cached(`screen:${color}`, () => new THREE.MeshStandardMaterial({ color: "#05070a", emissive: color, emissiveIntensity: 0.55, toneMapped: false })),
  fabric: (color: string) => cached(`fabric:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 })),
  solid: (color: string, roughness = 0.6) => cached(`solid:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1 })),
  plant: () => cached("plant", () => new THREE.MeshStandardMaterial({ color: "#1f6f4a", roughness: 0.8 })),
};
