import { cancelTask, taskCancelSchema } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

/** Optional body: { reason?: string } */
export const POST = apiRoute<{ id: string }>(
  async (ctx, req, { id }) => {
    const body = await readJson(req).catch(() => ({}));
    return cancelTask(ctx, id, taskCancelSchema.parse(body).reason);
  },
  { mutation: true },
);
