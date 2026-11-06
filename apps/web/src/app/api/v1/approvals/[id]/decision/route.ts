import { decideApproval } from "@vc/core";
import { apiRoute, readJson } from "@/lib/api";

/** Body: { decision: "approve" | "reject", note?: string, expectedVersion: number } */
export const POST = apiRoute<{ id: string }>(async (ctx, req, { id }) => decideApproval(ctx, id, (await readJson(req)) as never), {
  mutation: true,
});
