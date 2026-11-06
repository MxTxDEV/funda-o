import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GEO, MAT } from "./shared";

/**
 * Furniture "kits": each kit is a list of parts (one merged geometry per material) in kit-local
 * coordinates. Kits are rendered with InstancedKit (one draw call per part for ALL instances).
 * Dimensions are real-world meters.
 */
export type KitPart = { geometry: THREE.BufferGeometry; material: THREE.Material; castShadow: boolean };
export type Kit = KitPart[];

type Piece = {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  p?: [number, number, number];
  r?: [number, number, number];
  s?: [number, number, number];
  shadow?: boolean;
};

const tmp = new THREE.Object3D();
function place(piece: Piece) {
  tmp.position.set(...(piece.p ?? [0, 0, 0]));
  tmp.rotation.set(...(piece.r ?? [0, 0, 0]));
  tmp.scale.set(...(piece.s ?? [1, 1, 1]));
  tmp.updateMatrix();
  const g = (piece.geo.index ? piece.geo.toNonIndexed() : piece.geo.clone()).applyMatrix4(tmp.matrix);
  // keep only the attributes every geometry shares
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  return g;
}

export function buildKit(pieces: Piece[]): Kit {
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  for (const piece of pieces) {
    const entry = byMat.get(piece.mat) ?? { geos: [], shadow: false };
    entry.geos.push(place(piece));
    entry.shadow ||= piece.shadow !== false;
    byMat.set(piece.mat, entry);
  }
  return [...byMat.entries()].map(([material, { geos, shadow }]) => ({ geometry: mergeGeometries(geos)!, material, castShadow: shadow }));
}

const kitCache = new Map<string, Kit>();
function kit(key: string, make: () => Piece[]): Kit {
  let k = kitCache.get(key);
  if (!k) {
    k = buildKit(make());
    kitCache.set(key, k);
  }
  return k;
}

const B = GEO.box;
const R = GEO.roundBox;
const C = GEO.cylinder;
const S = GEO.sphere;

// ---------------------------------------------------------------- workstation (occupant sits at -z, faces +z)
export const deskKit = () =>
  kit("desk", () => [
    { geo: R, mat: MAT.wood("oak"), p: [0, 0.74, 0], s: [1.6, 0.04, 0.8] },
    // A-frame legs
    ...[-0.72, 0.72].flatMap((x) => [
      { geo: B, mat: MAT.blackMetal(), p: [x, 0.37, -0.3] as [number, number, number], s: [0.05, 0.72, 0.05] as [number, number, number] },
      { geo: B, mat: MAT.blackMetal(), p: [x, 0.37, 0.3] as [number, number, number], s: [0.05, 0.72, 0.05] as [number, number, number] },
      { geo: B, mat: MAT.blackMetal(), p: [x, 0.02, 0] as [number, number, number], s: [0.06, 0.04, 0.74] as [number, number, number] },
      { geo: B, mat: MAT.blackMetal(), p: [x, 0.7, 0] as [number, number, number], s: [0.05, 0.04, 0.66] as [number, number, number] },
    ]),
    { geo: B, mat: MAT.laminateWhite(), p: [0, 0.5, 0.36], s: [1.4, 0.3, 0.02] },
    // monitor
    { geo: R, mat: MAT.plasticDark(), p: [0, 0.768, 0.22], s: [0.24, 0.016, 0.16] },
    { geo: B, mat: MAT.aluminium(), p: [0, 0.92, 0.25], s: [0.035, 0.3, 0.025] },
    { geo: R, mat: MAT.plasticDark(), p: [0, 1.08, 0.23], s: [0.7, 0.41, 0.03] },
    // keyboard + mouse + mousepad
    { geo: R, mat: MAT.plasticLight(), p: [0, 0.772, -0.06], s: [0.44, 0.018, 0.14] },
    { geo: R, mat: MAT.plasticDark(), p: [0.33, 0.762, -0.06], s: [0.24, 0.004, 0.2] },
    { geo: S, mat: MAT.plasticLight(), p: [0.33, 0.772, -0.06], s: [0.032, 0.016, 0.05] },
    // cable tray
    { geo: B, mat: MAT.blackMetal(), p: [0, 0.62, 0.25], s: [1.1, 0.04, 0.12], shadow: false },
  ]);

/** Desk screen surface (rendered separately so its content can change with the employee status). */
export const SCREEN_LOCAL: { p: [number, number, number]; s: [number, number] } = { p: [0, 1.08, 0.213], s: [0.66, 0.37] };

export const deskLampKit = () =>
  kit("deskLamp", () => [
    { geo: C, mat: MAT.blackMetal(), p: [-0.62, 0.77, 0.26], s: [0.07, 0.02, 0.07] },
    { geo: C, mat: MAT.blackMetal(), p: [-0.62, 0.98, 0.26], s: [0.01, 0.42, 0.01] },
    { geo: C, mat: MAT.blackMetal(), p: [-0.5, 1.19, 0.2], r: [0, 0, Math.PI / 2.6], s: [0.01, 0.3, 0.01] },
    { geo: R, mat: MAT.blackMetal(), p: [-0.38, 1.24, 0.14], s: [0.16, 0.04, 0.08] },
  ]);

export const laptopKit = () =>
  kit("laptop", () => [
    { geo: R, mat: MAT.aluminium(), p: [-0.45, 0.773, -0.02], s: [0.32, 0.016, 0.22] },
    { geo: R, mat: MAT.aluminium(), p: [-0.45, 0.88, 0.09], r: [-0.35, 0, 0], s: [0.32, 0.21, 0.012] },
  ]);

export const deskPlantKit = () =>
  kit("deskPlant", () => [
    { geo: C, mat: MAT.ceramic("#d9d4ca"), p: [0.62, 0.82, 0.28], s: [0.06, 0.12, 0.06] },
    ...Array.from({ length: 6 }, (_, i) => ({
      geo: S,
      mat: MAT.leaf("#3b7a4a"),
      p: [0.62 + Math.cos(i) * 0.04, 0.94, 0.28 + Math.sin(i) * 0.04] as [number, number, number],
      r: [Math.cos(i) * 0.5, i, Math.sin(i) * 0.5] as [number, number, number],
      s: [0.03, 0.1, 0.06] as [number, number, number],
    })),
  ]);

export const headsetKit = () =>
  kit("headset", () => [
    { geo: GEO.torus, mat: MAT.plasticDark(), p: [0.55, 0.85, -0.25], r: [Math.PI / 2, 0, 0], s: [0.09, 0.09, 2.5] },
    { geo: S, mat: MAT.plasticDark(), p: [0.46, 0.8, -0.25], s: [0.035, 0.035, 0.02] },
    { geo: S, mat: MAT.plasticDark(), p: [0.64, 0.8, -0.25], s: [0.035, 0.035, 0.02] },
  ]);

export const notebookKit = () =>
  kit("notebook", () => [
    { geo: B, mat: MAT.paper("#f3f0e8"), p: [-0.35, 0.765, 0.05], r: [0, 0.2, 0], s: [0.21, 0.012, 0.29] },
    { geo: B, mat: MAT.paper("#2c4a7a"), p: [-0.35, 0.76, 0.05], r: [0, 0.2, 0], s: [0.215, 0.006, 0.295] },
    { geo: C, mat: MAT.ceramic("#f2f2f2"), p: [0.5, 0.81, 0.15], s: [0.04, 0.1, 0.04] },
  ]);

// ---------------------------------------------------------------- seating (faces +z, back at -z)
function chairPieces(executive: boolean): Piece[] {
  const seatMat = executive ? MAT.leather("#1d1a18") : MAT.fabric("#2b313d");
  const pieces: Piece[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    pieces.push({ geo: B, mat: MAT.blackMetal(), p: [Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15], r: [0, a, 0], s: [0.04, 0.03, 0.3] });
    pieces.push({ geo: S, mat: MAT.plasticDark(), p: [Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29], s: [0.028, 0.028, 0.028] });
  }
  pieces.push(
    { geo: C, mat: MAT.chrome(), p: [0, 0.26, 0], s: [0.025, 0.36, 0.025] },
    { geo: C, mat: MAT.blackMetal(), p: [0, 0.4, 0], s: [0.06, 0.04, 0.06] },
    { geo: R, mat: seatMat, p: [0, 0.47, 0], s: [0.5, 0.085, 0.48] },
    { geo: R, mat: executive ? seatMat : MAT.mesh(), p: [0, executive ? 0.98 : 0.86, -0.25], r: [-0.12, 0, 0], s: [0.47, executive ? 0.82 : 0.56, 0.06] },
    { geo: B, mat: MAT.blackMetal(), p: [0, 0.62, -0.27], r: [-0.12, 0, 0], s: [0.04, 0.3, 0.03] },
  );
  for (const x of [-0.26, 0.26]) {
    pieces.push({ geo: B, mat: MAT.blackMetal(), p: [x, 0.59, -0.02], s: [0.025, 0.2, 0.025] });
    pieces.push({ geo: R, mat: MAT.plasticDark(), p: [x, 0.69, 0.02], s: [0.06, 0.03, 0.26] });
  }
  return pieces;
}
export const chairKit = () => kit("chair", () => chairPieces(false));
export const executiveChairKit = () => kit("execChair", () => chairPieces(true));

export const sofaKit = (color = "#3a3f52") =>
  kit(`sofa:${color}`, () => [
    { geo: R, mat: MAT.fabric(color), p: [0, 0.24, 0], s: [2.3, 0.3, 0.92] },
    ...[-0.74, 0, 0.74].flatMap((x) => [
      { geo: R, mat: MAT.fabric(color), p: [x, 0.46, 0.06] as [number, number, number], s: [0.72, 0.15, 0.78] as [number, number, number] },
      { geo: R, mat: MAT.fabric(color), p: [x, 0.7, -0.34] as [number, number, number], r: [-0.12, 0, 0] as [number, number, number], s: [0.72, 0.48, 0.2] as [number, number, number] },
    ]),
    { geo: R, mat: MAT.fabric(color), p: [-1.13, 0.48, 0], s: [0.18, 0.5, 0.92] },
    { geo: R, mat: MAT.fabric(color), p: [1.13, 0.48, 0], s: [0.18, 0.5, 0.92] },
    ...[-1.05, 1.05].flatMap((x) => [-0.36, 0.36].map((z) => ({ geo: C, mat: MAT.wood("walnut"), p: [x, 0.04, z] as [number, number, number], s: [0.025, 0.08, 0.025] as [number, number, number] }))),
  ]);

export const armchairKit = (color = "#5b4636") =>
  kit(`armchair:${color}`, () => [
    { geo: R, mat: MAT.leather(color), p: [0, 0.3, 0], s: [0.8, 0.22, 0.78] },
    { geo: R, mat: MAT.leather(color), p: [0, 0.62, -0.32], r: [-0.18, 0, 0], s: [0.78, 0.6, 0.16] },
    { geo: R, mat: MAT.leather(color), p: [-0.38, 0.48, 0], s: [0.12, 0.3, 0.74] },
    { geo: R, mat: MAT.leather(color), p: [0.38, 0.48, 0], s: [0.12, 0.3, 0.74] },
    ...[-0.32, 0.32].flatMap((x) => [-0.3, 0.3].map((z) => ({ geo: C, mat: MAT.wood("walnut"), p: [x, 0.09, z] as [number, number, number], s: [0.025, 0.18, 0.025] as [number, number, number] }))),
  ]);

// ---------------------------------------------------------------- tables & storage
export const meetingTableKit = () =>
  kit("meetingTable", () => [
    { geo: R, mat: MAT.wood("walnut"), p: [0, 0.75, 0], s: [5, 0.06, 1.5] },
    { geo: R, mat: MAT.blackMetal(), p: [-1.6, 0.37, 0], s: [0.12, 0.72, 0.9] },
    { geo: R, mat: MAT.blackMetal(), p: [1.6, 0.37, 0], s: [0.12, 0.72, 0.9] },
    { geo: R, mat: MAT.blackMetal(), p: [0, 0.78, 0], s: [0.5, 0.015, 0.16] },
  ]);

export const coffeeTableKit = () =>
  kit("coffeeTable", () => [
    { geo: R, mat: MAT.wood("walnut"), p: [0, 0.4, 0], s: [1.3, 0.05, 0.7] },
    ...[-0.55, 0.55].flatMap((x) => [-0.25, 0.25].map((z) => ({ geo: B, mat: MAT.blackMetal(), p: [x, 0.19, z] as [number, number, number], s: [0.03, 0.38, 0.03] as [number, number, number] }))),
    { geo: C, mat: MAT.ceramic("#efece6"), p: [0.25, 0.47, 0.1], s: [0.04, 0.09, 0.04] },
    { geo: B, mat: MAT.paper("#c7b79d"), p: [-0.3, 0.435, -0.05], r: [0, 0.3, 0], s: [0.25, 0.02, 0.32] },
  ]);

export const cabinetKit = () =>
  kit("cabinet", () => [
    { geo: R, mat: MAT.laminateWhite(), p: [0, 0.38, 0], s: [1.8, 0.72, 0.46] },
    { geo: R, mat: MAT.wood("oak"), p: [0, 0.76, 0], s: [1.84, 0.04, 0.5] },
    ...[-0.6, 0, 0.6].map((x) => ({ geo: B, mat: MAT.aluminium(), p: [x, 0.62, 0.235] as [number, number, number], s: [0.22, 0.015, 0.015] as [number, number, number] })),
  ]);

const BOOK_COLORS = ["#2c3e5c", "#7a2e3a", "#d9c08a", "#3d5a4a", "#e2e8f0", "#1f2937"];
export const bookshelfKit = () =>
  kit("bookshelf", () => {
    const pieces: Piece[] = [
      { geo: B, mat: MAT.wood("ash"), p: [-0.62, 1.0, 0], s: [0.04, 2.0, 0.36] },
      { geo: B, mat: MAT.wood("ash"), p: [0.62, 1.0, 0], s: [0.04, 2.0, 0.36] },
      { geo: B, mat: MAT.wallDark(), p: [0, 1.0, -0.17], s: [1.22, 2.0, 0.02] },
    ];
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 5; i++) {
      const y = 0.05 + i * 0.47;
      pieces.push({ geo: B, mat: MAT.wood("ash"), p: [0, y, 0], s: [1.24, 0.03, 0.36] });
      if (i === 4) continue;
      let x = -0.56;
      while (x < 0.5) {
        const w = 0.03 + r() * 0.04;
        const h = 0.24 + r() * 0.12;
        if (r() > 0.85) {
          x += 0.12;
          continue;
        }
        pieces.push({ geo: B, mat: MAT.paper(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]!), p: [x + w / 2, y + 0.015 + h / 2, 0.02], s: [w, h, 0.22], shadow: false });
        x += w + 0.004;
      }
    }
    return pieces;
  });

export const floorPlantKit = (variant: 0 | 1 = 0) =>
  kit(`floorPlant:${variant}`, () => {
    const pieces: Piece[] = [
      { geo: C, mat: MAT.ceramic(variant ? "#2a2d33" : "#d9d4ca"), p: [0, 0.24, 0], s: [0.24, 0.48, 0.24] },
      { geo: C, mat: MAT.soil(), p: [0, 0.47, 0], s: [0.22, 0.02, 0.22], shadow: false },
    ];
    const n = variant ? 9 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tilt = 0.35 + (i % 3) * 0.18;
      pieces.push({
        geo: S,
        mat: MAT.leaf(i % 2 ? "#2f6b3f" : "#3e8250"),
        p: [Math.sin(a) * 0.12, 0.85 + (i % 4) * 0.12, Math.cos(a) * 0.12],
        r: [Math.cos(a) * tilt, a, Math.sin(a) * tilt],
        s: variant ? [0.05, 0.45, 0.18] : [0.045, 0.32, 0.12],
      });
    }
    return pieces;
  });

export const pendantKit = () =>
  kit("pendant", () => [
    { geo: C, mat: MAT.blackMetal(), p: [-0.5, 2.95, 0], s: [0.004, 0.5, 0.004], shadow: false },
    { geo: C, mat: MAT.blackMetal(), p: [0.5, 2.95, 0], s: [0.004, 0.5, 0.004], shadow: false },
    { geo: R, mat: MAT.blackMetal(), p: [0, 2.7, 0], s: [1.5, 0.05, 0.1], shadow: false },
    { geo: B, mat: MAT.lightPanel(), p: [0, 2.673, 0], s: [1.42, 0.005, 0.07], shadow: false },
  ]);

/** Acoustic divider between facing desks of a pod (spans three desks). */
export const podDividerKit = () =>
  kit("podDivider", () => [
    { geo: R, mat: MAT.fabric("#3a4356"), p: [0, 1.0, 0], s: [5.2, 0.5, 0.04] },
    { geo: B, mat: MAT.aluminium(), p: [0, 1.255, 0], s: [5.2, 0.02, 0.05] },
  ]);

export const whiteboardKit = () =>
  kit("whiteboard", () => [
    { geo: B, mat: MAT.aluminium(), p: [0, 1.5, 0], s: [2.0, 1.1, 0.03] },
    { geo: B, mat: MAT.laminateWhite(), p: [0, 1.5, 0.017], s: [1.94, 1.04, 0.005] },
    { geo: B, mat: MAT.aluminium(), p: [0, 0.94, 0.05], s: [1.6, 0.03, 0.08] },
  ]);
