import { AGENT_STATUSES, createAgent, listAgents } from "@vc/core";
import { apiRoute, readJson, searchParamsObject } from "@/lib/api";

export const GET = apiRoute((ctx, req) => {
  const q = searchParamsObject(req);
  return listAgents(ctx, {
    departmentId: q.departmentId,
    status: AGENT_STATUSES.find((s) => s === q.status),
    includeArchived: q.includeArchived === "true",
  });
});
export const POST = apiRoute(async (ctx, req) => createAgent(ctx, (await readJson(req)) as never), { mutation: true, status: 201 });
