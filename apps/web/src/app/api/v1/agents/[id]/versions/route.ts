import { createAgentVersion } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

export const POST = apiRoute<{ id: string }>(async (ctx, req, { id }) => createAgentVersion(ctx, id, (await readJson(req)) as never), {
  mutation: true,
  status: 201,
});
