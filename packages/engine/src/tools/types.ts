import type { Database } from "@vc/db";
import type { z } from "zod";

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>;

export type ToolHandlerContext = {
  db: Database;
  taskId: string | null;
  agentId: string | null;
  departmentId: string | null;
  signal: AbortSignal;
  fetch: (input: string, init: RequestInit) => Promise<Response>;
  lookup: LookupFn;
  env: Record<string, string | undefined>;
};

export type ToolSource = { kind: "web_page" | "search_result"; url: string; title: string; excerpt: string; contentHash?: string | null };

/** Standardized tool result. `content` is what the model reads; `data` is kept for audit. */
export type ToolOutcome = {
  summary: string;
  content: string;
  data: Record<string, unknown>;
  sources?: ToolSource[];
};

export type ToolHandler<S extends z.ZodType = z.ZodType> = {
  inputSchema: S;
  /** Description given to the model (may be more detailed than the catalog's). */
  modelDescription: string;
  run: (input: z.infer<S>, ctx: ToolHandlerContext) => Promise<ToolOutcome>;
};

/** Expected failure (bad URL, blocked host, upstream error): reported to the model, not retried. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/** Keeps the handler's input type inferred from its schema while storing it in the generic registry. */
export function defineTool<S extends z.ZodType>(handler: ToolHandler<S>): ToolHandler {
  return handler as unknown as ToolHandler;
}
