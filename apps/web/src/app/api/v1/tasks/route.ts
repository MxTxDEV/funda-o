import { createTask, listTasks } from "@vc/core";
import { apiRoute, readJson, searchParamsObject } from "@/lib/api";

export const GET = apiRoute((ctx, req) => listTasks(ctx, searchParamsObject(req)));

/** Supports the Idempotency-Key header to make client retries safe. */
export const POST = apiRoute(
  async (ctx, req) => {
    const body = await readJson(req);
    const idempotencyKey = req.headers.get("idempotency-key") ?? body.idempotencyKey;
    return createTask(ctx, { ...body, idempotencyKey } as never);
  },
  { mutation: true, status: 201 },
);
