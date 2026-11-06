"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server data periodically while the tab is visible (live operational views). */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
