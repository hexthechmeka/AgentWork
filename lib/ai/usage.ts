import "server-only";

import { recordUsageEvent } from "@/lib/db/queries";
import { computeCostUsd, providerForModel } from "./pricing";

// AI SDK usage objects have shifted shape across versions; accept both the
// v7 shape (inputTokens + inputTokenDetails.cacheReadTokens) and older ones.
type SdkUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  inputTokenDetails?: {
    cacheReadTokens?: number | null;
    noCacheTokens?: number | null;
  } | null;
};

/**
 * Record one model call's token usage + estimated cost. Best-effort: any
 * failure (bad usage shape, DB error) is swallowed so it can't break a
 * chat turn or a server action.
 */
export async function trackUsage({
  userId,
  modelId,
  usage,
}: {
  userId: string | undefined;
  modelId: string;
  usage: SdkUsage | undefined | null;
}): Promise<void> {
  try {
    if (!(userId && usage)) {
      return;
    }
    const provider = providerForModel(modelId);
    if (!provider) {
      return;
    }

    const inputTokens =
      Number(usage.inputTokens ?? usage.promptTokens ?? 0) || 0;
    const outputTokens =
      Number(usage.outputTokens ?? usage.completionTokens ?? 0) || 0;
    const cachedInputTokens =
      Number(
        usage.cachedInputTokens ?? usage.inputTokenDetails?.cacheReadTokens ?? 0
      ) || 0;

    if (inputTokens === 0 && outputTokens === 0) {
      return;
    }

    const costUsd = computeCostUsd({
      cachedInputTokens,
      inputTokens,
      modelId,
      outputTokens,
    });

    await recordUsageEvent({
      cachedInputTokens,
      costUsd,
      inputTokens,
      modelId,
      outputTokens,
      provider,
      userId,
    });
  } catch (error) {
    console.error("trackUsage failed:", error);
  }
}
