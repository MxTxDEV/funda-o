import { dispatchTask } from "@vc/core";
import { apiRoute } from "@/lib/api";

export const POST = apiRoute<{ id: string }>((ctx, _req, { id }) => dispatchTask(ctx, id), { mutation: true });
