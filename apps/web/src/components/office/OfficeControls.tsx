"use client";
import { DEPARTMENT_ZONES } from "@vc/core/client";
import { Crosshair, Gauge, Home, Orbit, RotateCcw, RotateCw, ScanSearch, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIXED_ROOM_LABELS, type FixedRoomKey } from "./layout";
import { type CameraCommand, useOfficeStore } from "./store";
import type { OfficeSnapshot } from "./types";

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-8 place-items-center rounded-md border text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-4",
        active ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-surface/90 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

/** Camera controls + environment picker (keyboard/mouse accessible alternative to 3D picking). */
export function OfficeControls({ snapshot }: { snapshot: OfficeSnapshot }) {
  const send = useOfficeStore((s) => s.sendCommand);
  const autoFrame = useOfficeStore((s) => s.autoFrame);
  const setAutoFrame = useOfficeStore((s) => s.setAutoFrame);
  const panorama = useOfficeStore((s) => s.panorama);
  const setPanorama = useOfficeStore((s) => s.setPanorama);
  const quality = useOfficeStore((s) => s.quality);
  const setQuality = useOfficeStore((s) => s.setQuality);
  const select = useOfficeStore((s) => s.select);
  const cmd = (c: CameraCommand) => () => send(c);

  const onPick = (value: string) => {
    if (!value) return;
    const [kind, id] = value.split(":") as [string, string];
    if (kind === "department") select({ kind: "department", id });
    else if (kind === "zone") select({ kind: "zone", id });
    else select({ kind: "room", id: id as FixedRoomKey });
    send("frame");
  };

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <select
        aria-label="Ir para ambiente"
        className="h-8 w-56 rounded-md border border-border bg-surface/95 px-2 text-xs text-foreground"
        value=""
        onChange={(e) => onPick(e.target.value)}
      >
        <option value="">Ir para ambiente…</option>
        <optgroup label="Departamentos">
          {DEPARTMENT_ZONES.map((z) => {
            const d = snapshot.departments.find((x) => x.zone === z.key);
            return (
              <option key={z.key} value={d ? `department:${d.id}` : `zone:${z.key}`}>
                {d ? `${d.name} (${z.label})` : `${z.label} — sem departamento`}
              </option>
            );
          })}
        </optgroup>
        <optgroup label="Áreas comuns">
          {(Object.keys(FIXED_ROOM_LABELS) as FixedRoomKey[]).filter((k) => k !== "executive").map((k) => (
            <option key={k} value={`room:${k}`}>
              {FIXED_ROOM_LABELS[k]}
            </option>
          ))}
        </optgroup>
      </select>
      <div className="flex gap-1.5">
        <IconButton label="Aproximar" onClick={cmd("zoom-in")}><ZoomIn /></IconButton>
        <IconButton label="Afastar" onClick={cmd("zoom-out")}><ZoomOut /></IconButton>
        <IconButton label="Girar à esquerda" onClick={cmd("rotate-left")}><RotateCcw /></IconButton>
        <IconButton label="Girar à direita" onClick={cmd("rotate-right")}><RotateCw /></IconButton>
        <IconButton label="Centralizar câmera" onClick={cmd("center")}><Crosshair /></IconButton>
        <IconButton label="Visão inicial" onClick={cmd("reset")}><Home /></IconButton>
        <IconButton label={panorama ? "Visão panorâmica: ligada" : "Visão panorâmica"} active={panorama} onClick={() => { if (!panorama) send("reset"); setPanorama(!panorama); }}>
          <Orbit />
        </IconButton>
        <IconButton label={autoFrame ? "Enquadramento automático: ligado" : "Enquadramento automático: desligado"} active={autoFrame} onClick={() => setAutoFrame(!autoFrame)}>
          <ScanSearch />
        </IconButton>
        <IconButton label={quality === "high" ? "Qualidade alta (clique para economizar)" : "Qualidade econômica (clique para alta)"} active={quality === "high"} onClick={() => setQuality(quality === "high" ? "low" : "high")}>
          <Gauge />
        </IconButton>
      </div>
      <p className="text-[10px] text-muted-foreground">Arraste para girar · botão direito para mover · role para zoom</p>
    </div>
  );
}
