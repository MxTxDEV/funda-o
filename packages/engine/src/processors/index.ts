import type { TaskType } from "@vc/core";
import { demoLifecycleProcessor } from "./demo-lifecycle";
import type { TaskProcessor } from "./types";

/** One processor per registered task type. The Central Brain processors will be added here. */
export const PROCESSORS: Record<TaskType, TaskProcessor> = {
  "demo.lifecycle": demoLifecycleProcessor,
};

export function getProcessor(type: string): TaskProcessor | undefined {
  return (PROCESSORS as Record<string, TaskProcessor>)[type];
}
