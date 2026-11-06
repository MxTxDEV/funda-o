import { getOfficeSnapshot } from "@vc/core";
import { apiRoute } from "@/lib/api";
import { scheduleDrain } from "@/lib/drain";

export const dynamic = "force-dynamic";

/** Real-time snapshot of the virtual office (polled by the 3D view). */
export const GET = apiRoute(async (ctx) => {
  const snapshot = await getOfficeSnapshot(ctx);
  const q = snapshot.brain.queue;
  if (q && q.waiting + q.delayed > 0) scheduleDrain();
  return snapshot;
});

export const maxDuration = 300;
