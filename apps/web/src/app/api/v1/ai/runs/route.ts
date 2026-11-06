import { listAgentRuns } from "@vc/core";
import { z } from "zod";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  agentId: z.uuid().optional(),
  taskId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Execution log of the Agent Runtime (tokens, cost, duration, errors). */
export const GET = apiRoute(async (ctx, req) => {
  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return { items: await listAgentRuns(ctx, q) };
});
