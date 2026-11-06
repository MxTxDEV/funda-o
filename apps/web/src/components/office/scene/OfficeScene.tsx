"use client";
import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { computeOfficeLayout, ROOM_CENTERS } from "../layout";
import type { OfficeSnapshot } from "../types";
import { CentralBrainObject } from "./CentralBrainObject";
import { DepartmentArea } from "./DepartmentArea";
import { EmployeeCharacter } from "./EmployeeCharacter";
import { ExecutiveRoom, MeetingRoom, RecreationRoom } from "./FixedRooms";
import { OfficeCamera } from "./OfficeCamera";
import { OfficeLighting } from "./OfficeLighting";
import { OfficeStructure } from "./OfficeStructure";

/** Whole office, derived from a real snapshot. Re-renders cheaply when the snapshot refreshes. */
export function OfficeScene({ snapshot, shadows }: { snapshot: OfficeSnapshot; shadows: boolean }) {
  const layout = useMemo(() => computeOfficeLayout(snapshot), [snapshot]);
  const agentsById = useMemo(() => new Map(snapshot.agents.map((a) => [a.id, a])), [snapshot]);
  const resting = snapshot.agents.filter((a) => layout.placements.get(a.id)?.seat === "lounge");
  const executing = snapshot.agents.filter((a) => a.officeStatus === "executing").length;
  const activity = Math.min(1, (executing + (snapshot.brain.queue?.active ?? 0)) / Math.max(3, snapshot.agents.length));

  return (
    <>
      <OfficeLighting shadows={shadows} />
      <OfficeCamera layout={layout} />
      <OfficeStructure />
      <CentralBrainObject activity={activity} integrated={snapshot.brain.integrated} />
      {/* data links: brain → rooms whose department is executing work right now */}
      {layout.rooms
        .filter((r) => r.department && snapshot.agents.some((a) => a.departmentId === r.department!.id && a.officeStatus === "executing"))
        .map((r) => (
          <Line
            key={r.zone}
            points={[
              [ROOM_CENTERS.brain[0], 0.2, ROOM_CENTERS.brain[2]],
              [(ROOM_CENTERS.brain[0] + r.center[0]) / 2, 0.2, (ROOM_CENTERS.brain[2] + r.center[2]) / 2],
              [r.center[0], 0.2, r.center[2]],
            ]}
            color="#3d7bff"
            lineWidth={1.5}
            transparent
            opacity={0.55}
            dashed
            dashSize={0.4}
            gapSize={0.3}
          />
        ))}
      {layout.rooms.map((room) => (
        <DepartmentArea key={room.zone} room={room} layout={layout} agentsById={agentsById} />
      ))}
      <ExecutiveRoom pendingApprovals={snapshot.metrics.pendingApprovals} activeTasks={snapshot.metrics.activeTasks} />
      <MeetingRoom />
      <RecreationRoom resting={resting} />
      {resting.map((a) => {
        const p = layout.placements.get(a.id)!;
        return <EmployeeCharacter key={a.id} agent={a} position={p.position} rotationY={p.rotationY} onSofa />;
      })}
    </>
  );
}
