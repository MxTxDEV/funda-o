import { getTask } from "@vc/core";
import { apiRoute } from "@/lib/api";

export const GET = apiRoute<{ id: string }>((ctx, _req, { id }) => getTask(ctx, id));
