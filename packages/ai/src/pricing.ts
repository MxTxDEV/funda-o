import { z } from "zod";
import type { TokenUsage } from "./types";

/**
 * Model prices are NOT hard-coded (they change and differ per contract). The operator configures
 * them in AI_MODEL_PRICING as JSON: {"anthropic/<model-id>": {"inputPerMTokUsd": 3, "outputPerMTokUsd": 15}}.
 * Without a price the cost is reported as unavailable — never guessed.
 */
const priceSchema = z.object({ inputPerMTokUsd: z.number().min(0), outputPerMTokUsd: z.number().min(0) });
const pricingSchema = z.record(z.string(), priceSchema);
export type ModelPrice = z.infer<typeof priceSchema>;

export function readPricing(env: Record<string, string | undefined> = process.env): Record<string, ModelPrice> {
  const raw = env.AI_MODEL_PRICING?.trim();
  if (!raw) return {};
  try {
    const parsed = pricingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function priceFor(provider: string, model: string, pricing = readPricing()): ModelPrice | null {
  return pricing[`${provider}/${model}`] ?? null;
}

export function estimateCostUsd(price: ModelPrice | null, usage: TokenUsage | null): number | null {
  if (!price || !usage) return null;
  const cost = (usage.inputTokens * price.inputPerMTokUsd + usage.outputTokens * price.outputPerMTokUsd) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
