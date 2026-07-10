import type { FortuneAiConfig } from "./config.js";
import type { ChatCompletionMessage } from "./prompts.js";

export interface ProviderUsage {
  completionTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
  promptTokens: number;
}

function priceTokens(tokens: number, usdPerMillion: number): number {
  return tokens * usdPerMillion * 1000;
}

export function calculateActualCostNanoUsd(
  usage: ProviderUsage,
  config: FortuneAiConfig,
): number {
  const describedPromptTokens =
    usage.promptCacheHitTokens + usage.promptCacheMissTokens;
  const fallbackMissTokens = Math.max(
    0,
    usage.promptTokens - describedPromptTokens,
  );

  return Math.ceil(
    priceTokens(
      usage.promptCacheHitTokens,
      config.inputCacheHitUsdPerMillion,
    ) +
      priceTokens(
        usage.promptCacheMissTokens + fallbackMissTokens,
        config.inputCacheMissUsdPerMillion,
      ) +
      priceTokens(usage.completionTokens, config.outputUsdPerMillion),
  );
}

export function calculateReservationNanoUsd(
  messages: ChatCompletionMessage[],
  maxTokens: number,
  config: FortuneAiConfig,
): number {
  const promptBytes = Buffer.byteLength(JSON.stringify(messages), "utf8");
  const worstCaseCost =
    priceTokens(promptBytes, config.inputCacheMissUsdPerMillion) +
    priceTokens(maxTokens, config.outputUsdPerMillion);

  return Math.ceil(worstCaseCost * 1.1);
}
