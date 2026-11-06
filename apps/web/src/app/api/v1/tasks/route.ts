import { createTask, listTasks } from "@vc/core";
import { scheduleDrain } from "@/lib/drain";
import { apiRoute, readJson, searchParamsObject } from "@/lib/api";

export const GET = apiRoute((ctx, req) => listTasks(ctx, searchParamsObject(req)));

/** Supports the Idempotency-Key header to make client retries safe. */
export const POST = apiRoute(
  async (ctx, req) => {
    const body = await readJson(req);
    const idempotencyKey = req.headers.get("idempotency-key") ?? body.idempotencyKey;
    const result = await createTask(ctx, { ...body, idempotencyKey } as never);
    if (result.task.status === "queued") scheduleDrain();
    return result;
  },
  { mutation: true, status: 201 },
);

export const maxDuration = 300;
