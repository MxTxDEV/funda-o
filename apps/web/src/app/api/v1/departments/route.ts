import { createDepartment, listDepartments } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

export const GET = apiRoute((ctx) => listDepartments(ctx));
export const POST = apiRoute(async (ctx, req) => createDepartment(ctx, (await readJson(req)) as never), { mutation: true, status: 201 });
