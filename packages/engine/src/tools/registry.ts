import { computeMetrics } from "./metrics";
import { tasksLookup } from "./tasks-lookup";
import type { ToolHandler } from "./types";
import { webFetchPage } from "./web-fetch";
import { webSearch } from "./web-search";

/** Executable handlers by tool id. Tools declared in the catalog without a handler are never offered. */
export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  "web.search": webSearch,
  "web.fetch_page": webFetchPage,
  "analytics.compute_metrics": computeMetrics,
  "tasks.lookup": tasksLookup,
};

/** Provider-safe function name for a tool id (dots are not allowed by the APIs). */
export const toolNameFor = (id: string) => id.replace(/\./g, "__");
export const toolIdFor = (name: string) => name.replace(/__/g, ".");
