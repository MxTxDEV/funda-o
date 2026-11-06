import { agentStatusSchema, setAgentStatus } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

export const POST = apiRoute<{ id: string }>(
  async (ctx, req, { id }) => setAgentStatus(ctx, id, agentStatusSchema.parse(await readJson(req)).status),
  { mutation: true },
);
