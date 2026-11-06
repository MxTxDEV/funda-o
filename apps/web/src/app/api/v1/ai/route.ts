import { getAiActivity, getAiOverview } from "@vc/core";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** AI providers (credential presence only — never values), company limits and today's usage. */
export const GET = apiRoute(async (ctx) => {
  const [overview, activity] = await Promise.all([getAiOverview(ctx), getAiActivity(ctx)]);
  return { ...overview, activity };
});
