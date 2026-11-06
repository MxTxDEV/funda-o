"use client";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ScreenState, ScreenTransform } from "./furnishing";
import { screenTexture } from "./textures";

/**
 * Desk screens, instanced by state: "active" (employee executing a task — content scrolls),
 * "idle" (lock screen) and "off" (empty desk). Content is decorative and never shows data.
 */
export function Screens({ screens, animate }: { screens: ScreenTransform[]; animate: boolean }) {
  const groups = useMemo(() => {
    const g: Record<ScreenState, ScreenTransform[]> = { active: [], idle: [], off: [] };
    for (const s of screens) g[s.state].push(s);
    return g;
  }, [screens]);
  const activeMat = useMemo(() => {
    const map = screenTexture("active").clone();
    map.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.25) });
  }, []);
  const idleMat = useMemo(() => new THREE.MeshBasicMaterial({ map: screenTexture("idle"), toneMapped: false }), []);
  const offMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#050608", roughness: 0.15, metalness: 0.3 }), []);

  useFrame((_, delta) => {
    if (animate && activeMat.map) activeMat.map.offset.y = (activeMat.map.offset.y + delta * 0.06) % 1;
  });

  return (
    <>
      <ScreenInstances list={groups.active} material={activeMat} />
      <ScreenInstances list={groups.idle} material={idleMat} />
      <ScreenInstances list={groups.off} material={offMat} />
    </>
  );
}

const plane = new THREE.PlaneGeometry(1, 1);

function ScreenInstances({ list, material }: { list: ScreenTransform[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    list.forEach((s, i) => {
      o.position.set(...s.position);
      o.rotation.set(0, s.rotationY, 0);
      o.scale.set(s.width, s.height, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list]);
  if (list.length === 0) return null;
  return <instancedMesh key={list.length} ref={ref} args={[plane, material, list.length]} frustumCulled={false} />;
}
