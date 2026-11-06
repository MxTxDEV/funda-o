import { decideApproval } from "@vc/core";
import { scheduleDrain } from "@/lib/drain";
import { apiRoute, readJson } from "@/lib/api";

/** Body: { decision: "approve" | "reject", note?: string, expectedVersion: number } */
export const POST = apiRoute<{ id: string }>(
  async (ctx, req, { id }) => {
    const result = await decideApproval(ctx, id, (await readJson(req)) as never);
    if (result.task) scheduleDrain();
    return result;
  },
  { mutation: true },
);

export const maxDuration = 300;
