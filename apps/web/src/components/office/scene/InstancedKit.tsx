"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Kit } from "./furniture";

export type KitTransform = { position: [number, number, number]; rotationY?: number; scale?: number };

/** Renders N instances of a furniture kit: one InstancedMesh (one draw call) per material part. */
export function InstancedKit({ kit, transforms, shadows = true }: { kit: Kit; transforms: KitTransform[]; shadows?: boolean }) {
  return (
    <>
      {kit.map((part, i) => (
        <KitPartInstances key={`${i}:${transforms.length}`} geometry={part.geometry} material={part.material} castShadow={shadows && part.castShadow} transforms={transforms} />
      ))}
    </>
  );
}

function KitPartInstances({
  geometry,
  material,
  castShadow,
  transforms,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
  transforms: KitTransform[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const key = useMemo(() => transforms.map((t) => `${t.position.join(",")}:${t.rotationY ?? 0}:${t.scale ?? 1}`).join("|"), [transforms]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    transforms.forEach((t, i) => {
      o.position.set(...t.position);
      o.rotation.set(0, t.rotationY ?? 0, 0);
      o.scale.setScalar(t.scale ?? 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (transforms.length === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, transforms.length)]} castShadow={castShadow} receiveShadow frustumCulled={false} />;
}
