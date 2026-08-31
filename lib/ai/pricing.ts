// USD per 1,000,000 tokens. Sources (checked 2026-08-29):
//   Anthropic — claude-api skill pricing table (Anthropic first-party rates).
//   GLM — https://docs.z.ai/guides/overview/pricing (Z.AI direct API, USD).
//
// The GLM API we actually call (open.bigmodel.cn) bills in RMB; these are the
// USD-equivalent Z.AI rates, which is what we want for a USD cost estimate.
// glm-5v-turbo isn't in Z.AI's public price list — we use the current-gen
// vision rate (GLM-4.6V) as the estimate.

export type UsageProvider = "anthropic" | "glm";

export type ModelRate = {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
  /** USD per 1M cache-read input tokens (Anthropic ~0.1x input) */
  cachedInput: number;
  /** true when the rate is an estimate rather than a published number */
  estimated?: boolean;
};

export const MODEL_PRICING: Record<string, ModelRate> = {
  "anthropic/claude-haiku-4-5-20251001": {
    cachedInput: 0.1,
    input: 1,
    output: 5,
  },
  "anthropic/claude-opus-5": { cachedInput: 0.5, input: 5, output: 25 },
  "anthropic/claude-sonnet-5": { cachedInput: 0.2, input: 2, output: 10 },
  "glm/glm-5.2": { cachedInput: 1.4, input: 1.4, output: 4.4 },
  "glm/glm-5.3": { cachedInput: 1.4, input: 1.4, output: 4.4 },
  "glm/glm-5v-turbo": {
    cachedInput: 0.3,
    estimated: true,
    input: 0.3,
    output: 0.9,
  },
};

export function providerForModel(modelId: string): UsageProvider | null {
  if (modelId.startsWith("anthropic/")) {
    return "anthropic";
  }
  if (modelId.startsWith("glm/")) {
    return "glm";
  }
  return null;
}

const PER_MILLION = 1_000_000;

/**
 * Estimated USD cost of one model call. `cachedInputTokens` (Anthropic cache
 * reads) is priced at the cache-read rate and subtracted from the full-price
 * input tokens.
 */
export function computeCostUsd({
  modelId,
  inputTokens,
  outputTokens,
  cachedInputTokens = 0,
}: {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}): number {
  const rate = MODEL_PRICING[modelId];
  if (!rate) {
    return 0;
  }
  const billedInput = Math.max(0, inputTokens - cachedInputTokens);
  const cost =
    (billedInput * rate.input +
      cachedInputTokens * rate.cachedInput +
      outputTokens * rate.output) /
    PER_MILLION;
  return Number.isFinite(cost) ? cost : 0;
}

export type HeadroomLevel = "neutral" | "warn" | "danger";

/**
 * Colour bucket for the usage graph, by remaining headroom vs. the hard limit:
 *   > 30% left → neutral, ≤ 30% left → warn (yellow), ≤ 10% left → danger (red).
 * No hard limit set → always neutral.
 */
export function headroomLevel(
  costUsd: number,
  hardLimitUsd: number | null | undefined
): HeadroomLevel {
  if (!hardLimitUsd || hardLimitUsd <= 0) {
    return "neutral";
  }
  const remaining = (hardLimitUsd - costUsd) / hardLimitUsd;
  if (remaining <= 0.1) {
    return "danger";
  }
  if (remaining <= 0.3) {
    return "warn";
  }
  return "neutral";
}
