import type { ApprovalRequest, RunContext } from "@vc/core";

export type ProcessorContext = RunContext & {
  /** Total attempts made for this task (including the current one). */
  attempt: number;
  progress: (message: string, data?: Record<string, unknown>) => Promise<void>;
  /** True when the task was cancelled or superseded: the processor must stop. */
  isAborted: () => Promise<boolean>;
};

export type ProcessorOutcome =
  | { kind: "completed"; result: Record<string, unknown> }
  | { kind: "needs_approval"; approval: ApprovalRequest; partialResult?: Record<string, unknown> }
  | { kind: "aborted" };

export type TaskProcessor = (ctx: ProcessorContext) => Promise<ProcessorOutcome>;
