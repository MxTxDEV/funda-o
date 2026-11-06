import type { TaskType } from "@vc/core";
import { agentExecuteProcessor } from "./agent-execute";
import { demoLifecycleProcessor } from "./demo-lifecycle";
import type { TaskProcessor } from "./types";

/** One processor per registered task type. */
export const PROCESSORS: Record<TaskType, TaskProcessor> = {
  "agent.execute": agentExecuteProcessor,
  "demo.lifecycle": demoLifecycleProcessor,
};

export function getProcessor(type: string): TaskProcessor | undefined {
  return (PROCESSORS as Record<string, TaskProcessor>)[type];
}
