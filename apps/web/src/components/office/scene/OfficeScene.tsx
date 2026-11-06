"use client";
import { useMemo } from "react";
import { computeOfficeLayout } from "../layout";
import { useOfficeStore } from "../store";
import type { OfficeSnapshot } from "../types";
import { type BrainLink, CentralBrainObject } from "./CentralBrainObject";
import { DepartmentArea } from "./DepartmentArea";
import { EmployeeCharacter } from "./EmployeeCharacter";
import { MeetingRoom, RecreationRoom } from "./FixedRooms";
import { computeFurnishing } from "./furnishing";
import {
  armchairKit,
  bookshelfKit,
  cabinetKit,
  chairKit,
  coffeeTableKit,
  deskKit,
  deskLampKit,
  deskPlantKit,
  executiveChairKit,
  floorPlantKit,
  headsetKit,
  laptopKit,
  meetingTableKit,
  notebookKit,
  pendantKit,
  podDividerKit,
  sofaKit,
  whiteboardKit,
} from "./furniture";
import { InstancedKit } from "./InstancedKit";
import { OfficeCamera } from "./OfficeCamera";
import { OfficeLighting } from "./OfficeLighting";
import { OfficeStructure } from "./OfficeStructure";
import { Screens } from "./Screens";

/** Whole office, derived from a real snapshot (layout → furnishing → instanced furniture + people). */
export function OfficeScene({ snapshot }: { snapshot: OfficeSnapshot }) {
  const quality = useOfficeStore((s) => s.quality);
  const high = quality === "high";
  const layout = useMemo(() => computeOfficeLayout(snapshot), [snapshot]);
  const agentsById = useMemo(() => new Map(snapshot.agents.map((a) => [a.id, a])), [snapshot]);
  const furnishing = useMemo(() => computeFurnishing(layout, agentsById), [layout, agentsById]);
  const resting = snapshot.agents.filter((a) => layout.placements.get(a.id)?.seat === "lounge");
  const executing = snapshot.agents.filter((a) => a.officeStatus === "executing").length;
  const activity = Math.min(1, (executing + (snapshot.brain.queue?.active ?? 0)) / Math.max(3, snapshot.agents.length));
  const deptColor = new Map(snapshot.departments.map((d) => [d.id, d.color]));
  const deptName = new Map(snapshot.departments.map((d) => [d.id, d.name]));

  const links: BrainLink[] = layout.rooms
    .filter((r) => r.department)
    .map((r) => {
      const members = snapshot.agents.filter((a) => a.departmentId === r.department!.id);
      const busy = members.filter((a) => a.officeStatus === "executing").length;
      return { zone: r.zone, target: r.center, color: r.department!.color, activity: members.length ? busy / members.length : 0 };
    });

  const f = furnishing;
  return (
    <>
      <OfficeLighting shadows={high} high={high} />
      <OfficeCamera layout={layout} />
      <OfficeStructure />

      <InstancedKit kit={deskKit()} transforms={f.desks} shadows={high} />
      <InstancedKit kit={chairKit()} transforms={f.chairs} shadows={high} />
      <InstancedKit kit={executiveChairKit()} transforms={f.execChairs} shadows={high} />
      <InstancedKit kit={podDividerKit()} transforms={f.dividers} shadows={high} />
      <InstancedKit kit={pendantKit()} transforms={f.pendants} shadows={false} />
      <InstancedKit kit={deskLampKit()} transforms={f.lamps} shadows={false} />
      <InstancedKit kit={laptopKit()} transforms={f.laptops} shadows={false} />
      <InstancedKit kit={deskPlantKit()} transforms={f.deskPlants} shadows={false} />
      <InstancedKit kit={headsetKit()} transforms={f.headsets} shadows={false} />
      <InstancedKit kit={notebookKit()} transforms={f.notebooks} shadows={false} />
      <InstancedKit kit={floorPlantKit(0)} transforms={f.plants} shadows={high} />
      <InstancedKit kit={floorPlantKit(1)} transforms={f.tallPlants} shadows={high} />
      <InstancedKit kit={cabinetKit()} transforms={f.cabinets} shadows={high} />
      <InstancedKit kit={bookshelfKit()} transforms={f.bookshelves} shadows={high} />
      <InstancedKit kit={whiteboardKit()} transforms={f.whiteboards} shadows={false} />
      <InstancedKit kit={sofaKit()} transforms={f.sofas} shadows={high} />
      <InstancedKit kit={armchairKit()} transforms={f.armchairs} shadows={high} />
      <InstancedKit kit={coffeeTableKit()} transforms={f.coffeeTables} shadows={high} />
      <InstancedKit kit={meetingTableKit()} transforms={f.meetingTables} shadows={high} />
      <Screens screens={f.screens} animate={high} />

      <CentralBrainObject activity={activity} integrated={snapshot.brain.integrated} links={links} />
      {layout.rooms.map((room) => (
        <DepartmentArea key={room.zone} room={room} layout={layout} agentsById={agentsById} metrics={snapshot.metrics} />
      ))}
      <MeetingRoom />
      <RecreationRoom restingCount={resting.length} />
      {resting.map((a) => {
        const p = layout.placements.get(a.id)!;
        return (
          <EmployeeCharacter
            key={a.id}
            agent={a}
            position={p.position}
            rotationY={p.rotationY}
            onSofa
            accent={deptColor.get(a.departmentId) ?? "#3d7bff"}
            departmentName={deptName.get(a.departmentId)}
          />
        );
      })}
    </>
  );
}
