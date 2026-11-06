import { dispatchTask } from "@vc/core";
import { scheduleDrain } from "@/lib/drain";
import { apiRoute } from "@/lib/api";

export const POST = apiRoute<{ id: string }>(
  async (ctx, _req, { id }) => {
    const result = await dispatchTask(ctx, id);
    scheduleDrain();
    return result;
  },
  { mutation: true },
);

export const maxDuration = 300;
