import { getApproval } from "@vc/core";
import { apiRoute } from "@/lib/api";

export const GET = apiRoute<{ id: string }>((ctx, _req, { id }) => getApproval(ctx, id));
