import { getAgent, updateAgent } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

type P = { id: string };

export const GET = apiRoute<P>((ctx, _req, { id }) => getAgent(ctx, id));
export const PATCH = apiRoute<P>(async (ctx, req, { id }) => updateAgent(ctx, id, (await readJson(req)) as never), { mutation: true });
