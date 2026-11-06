/** Company-wide AI execution controls, configured through backend environment variables. */
export type CompanyAiLimits = {
  /** Kill switch: AI_EXECUTION_ENABLED=false blocks every new model call. */
  enabled: boolean;
  dailyTokenLimit: number | null;
  dailyCostLimitUsd: number | null;
  requestTimeoutMs: number;
};

function positive(v: string | undefined): number | null {
  if (!v?.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readCompanyAiLimits(env: Record<string, string | undefined> = process.env): CompanyAiLimits {
  return {
    enabled: env.AI_EXECUTION_ENABLED?.trim().toLowerCase() !== "false",
    dailyTokenLimit: positive(env.AI_DAILY_TOKEN_LIMIT),
    dailyCostLimitUsd: positive(env.AI_DAILY_COST_LIMIT_USD),
    requestTimeoutMs: Math.min(positive(env.AI_REQUEST_TIMEOUT_MS) ?? 120_000, 280_000),
  };
}
