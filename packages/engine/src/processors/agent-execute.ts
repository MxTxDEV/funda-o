import { runAgentTask } from "../runtime/agent-runtime";
import type { TaskProcessor } from "./types";

/** Real AI execution of a task by its assigned employee (see Agent Runtime). */
export const agentExecuteProcessor: TaskProcessor = (ctx) => runAgentTask(ctx);
