import { getDashboard } from "@vc/core";
import { apiRoute } from "@/lib/api";

export const GET = apiRoute((ctx) => getDashboard(ctx));
