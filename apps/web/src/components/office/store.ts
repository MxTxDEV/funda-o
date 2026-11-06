import { create } from "zustand";
import type { FixedRoomKey } from "./layout";

export type Selection =
  | { kind: "agent"; id: string }
  | { kind: "department"; id: string }
  | { kind: "zone"; id: string }
  | { kind: "room"; id: FixedRoomKey }
  | null;

export type CameraCommand = "reset" | "center" | "zoom-in" | "zoom-out" | "rotate-left" | "rotate-right" | "frame";

type OfficeState = {
  selection: Selection;
  hovered: string | null;
  autoFrame: boolean;
  panorama: boolean;
  quality: "high" | "low";
  command: { type: CameraCommand; nonce: number } | null;
  select: (s: Selection) => void;
  setHovered: (id: string | null) => void;
  setAutoFrame: (v: boolean) => void;
  setPanorama: (v: boolean) => void;
  setQuality: (q: "high" | "low") => void;
  sendCommand: (type: CameraCommand) => void;
};

/** UI state of the 3D office (selection, camera commands). Never holds business data. */
export const useOfficeStore = create<OfficeState>((set) => ({
  selection: null,
  hovered: null,
  autoFrame: true,
  panorama: false,
  quality: "high",
  command: null,
  select: (selection) => set((s) => ({ selection, command: s.autoFrame && selection ? { type: "frame", nonce: Date.now() } : s.command })),
  setHovered: (hovered) => set({ hovered }),
  setAutoFrame: (autoFrame) => set({ autoFrame }),
  setPanorama: (panorama) => set({ panorama }),
  setQuality: (quality) => set({ quality }),
  sendCommand: (type) => set({ command: { type, nonce: Date.now() + Math.random() } }),
}));
