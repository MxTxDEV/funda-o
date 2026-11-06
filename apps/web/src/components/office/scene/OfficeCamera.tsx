"use client";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useRef } from "react";
import * as THREE from "three";
import { focusPoint, type OfficeLayout } from "../layout";
import { useOfficeStore } from "../store";

export const INITIAL_POSITION = new THREE.Vector3(30, 34, 42);
export const INITIAL_TARGET = new THREE.Vector3(1, 0, 1.5);

/**
 * Orbit/pan/zoom controls plus smooth "fly-to" animations driven by camera commands
 * (reset, center, zoom, rotate, frame selection). User interaction cancels an animation.
 */
export function OfficeCamera({ layout }: { layout: OfficeLayout }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const command = useOfficeStore((s) => s.command);
  const selection = useOfficeStore((s) => s.selection);
  const panorama = useOfficeStore((s) => s.panorama);
  const setPanorama = useOfficeStore((s) => s.setPanorama);

  useEffect(() => {
    const c = controls.current;
    if (!command || !c) return;
    const target = c.target.clone();
    const offset = camera.position.clone().sub(target);
    switch (command.type) {
      case "reset":
        goal.current = { position: INITIAL_POSITION.clone(), target: INITIAL_TARGET.clone() };
        break;
      case "center":
        goal.current = { position: new THREE.Vector3(0, 0, 0).add(offset), target: new THREE.Vector3(0, 0, 0) };
        break;
      case "zoom-in":
      case "zoom-out": {
        const k = command.type === "zoom-in" ? 0.7 : 1.4;
        const len = THREE.MathUtils.clamp(offset.length() * k, c.minDistance, c.maxDistance);
        goal.current = { position: target.clone().add(offset.setLength(len)), target };
        break;
      }
      case "rotate-left":
      case "rotate-right": {
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), command.type === "rotate-left" ? Math.PI / 4 : -Math.PI / 4);
        goal.current = { position: target.clone().add(offset), target };
        break;
      }
      case "frame": {
        if (!selection) break;
        const f = focusPoint(layout, selection.kind, selection.id);
        if (!f) break;
        const subject = new THREE.Vector3(...f.target);
        const dir = INITIAL_POSITION.clone().sub(INITIAL_TARGET).normalize();
        // The details panel covers the right side: aim slightly right so the subject sits left of center.
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
        const t = subject.clone().add(right.multiplyScalar(f.distance * 0.22));
        goal.current = { position: t.clone().add(dir.multiplyScalar(f.distance)), target: t };
        break;
      }
    }
    // only react to new commands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.nonce]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!goal.current || !c) return;
    const k = 1 - Math.exp(-delta * 4);
    camera.position.lerp(goal.current.position, k);
    c.target.lerp(goal.current.target, k);
    c.update();
    if (camera.position.distanceTo(goal.current.position) < 0.05 && c.target.distanceTo(goal.current.target) < 0.05) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={INITIAL_TARGET}
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={75}
      maxPolarAngle={Math.PI / 2.3}
      minPolarAngle={0.25}
      screenSpacePanning={false}
      autoRotate={panorama}
      autoRotateSpeed={0.35}
      zoomSpeed={0.7}
      rotateSpeed={0.6}
      panSpeed={0.8}
      onStart={() => {
        goal.current = null;
        if (panorama) setPanorama(false);
      }}
    />
  );
}
