import type { OfficeSnapshot } from "@vc/core";

export type { OfficeSnapshot };
export type OfficeAgent = OfficeSnapshot["agents"][number];
export type OfficeDepartment = OfficeSnapshot["departments"][number];
export type Vec3 = [number, number, number];
