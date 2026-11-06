import { listAuditLogs } from "@vc/core";
import { apiRoute, searchParamsObject } from "@/lib/api";

export const GET = apiRoute((ctx, req) => listAuditLogs(ctx, searchParamsObject(req)));
