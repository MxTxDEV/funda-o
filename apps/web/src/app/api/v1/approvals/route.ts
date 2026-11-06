import { listApprovals } from "@vc/core";
import { apiRoute, searchParamsObject } from "@/lib/api";

export const GET = apiRoute((ctx, req) => listApprovals(ctx, searchParamsObject(req)));
