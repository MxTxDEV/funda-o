type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL ?? "info") as Level;
  return ORDER[lvl] ?? ORDER.info;
}

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

function log(level: Level, msg: string, data?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return;
  const entry: Record<string, unknown> = { level, time: new Date().toISOString(), msg };
  if (data) {
    for (const [k, v] of Object.entries(data)) entry[k] = k === "err" ? serializeError(v) : v;
  }
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
