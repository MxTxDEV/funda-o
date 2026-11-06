"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OfficeSnapshot } from "./types";

/** Polls the office snapshot while the tab is visible. The database stays the source of truth. */
export function useOfficeData(initial: OfficeSnapshot, intervalMs = 5000) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/v1/office", { cache: "no-store", headers: { accept: "application/json" } });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: OfficeSnapshot };
      setSnapshot(body.data);
      setError(null);
    } catch {
      setError("Falha ao atualizar dados em tempo real. Tentando novamente…");
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { snapshot, error, refresh };
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
