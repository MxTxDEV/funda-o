import { departmentActiveSchema, getDepartment, setDepartmentActive, updateDepartment } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

type P = { id: string };

export const GET = apiRoute<P>((ctx, _req, { id }) => getDepartment(ctx, id));

/** Body: any of {name, description, color} and/or {isActive}. */
export const PATCH = apiRoute<P>(
  async (ctx, req, { id }) => {
    const { isActive, ...rest } = await readJson(req);
    if (Object.keys(rest).length) await updateDepartment(ctx, id, rest as never);
    if (isActive !== undefined) await setDepartmentActive(ctx, id, departmentActiveSchema.parse({ isActive }).isActive);
    return getDepartment(ctx, id);
  },
  { mutation: true },
);
