import { z } from "zod";
import type { FortuneAiConfig } from "./config.js";
import { calculateActualCostNanoUsd, type ProviderUsage } from "./cost.js";
import { FortuneServiceError } from "./errors.js";
import type { BuiltPrompt } from "./prompts.js";
import type { UsageRecord } from "./usageStore.js";

const usageSchema = z.object({
  completion_tokens: z.number().int().nonnegative(),
  prompt_cache_hit_tokens: z.number().int().nonnegative().optional(),
  prompt_cache_miss_tokens: z.number().int().nonnegative().optional(),
  prompt_tokens: z.number().int().nonnegative(),
}).passthrough();

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string(),
    }).passthrough(),
  }).passthrough()).min(1),
  usage: usageSchema.optional(),
}).passthrough();

export interface ProviderResult {
  text: string;
  usage: UsageRecord | null;
}

export interface CompletionProvider {
  complete(prompt: BuiltPrompt, userId: string): Promise<ProviderResult>;
}

export class ProviderClient implements CompletionProvider {
  constructor(private readonly config: FortuneAiConfig) {}

  async complete(prompt: BuiltPrompt, userId: string): Promise<ProviderResult> {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new FortuneServiceError(
        503,
        "AI_UNAVAILABLE",
        "AI 解读暂时不可用，请稍后再试。",
        30,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.providerTimeoutMs,
    );

    try {
      const response = await fetch(
        `${this.config.providerBaseUrl}/chat/completions`,
        {
          body: JSON.stringify({
            max_tokens: prompt.maxTokens,
            messages: prompt.messages,
            model: this.config.model,
            temperature: 0.68,
            user_id: userId,
          }),
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new FortuneServiceError(
          response.status === 429 ? 503 : 502,
          "AI_UNAVAILABLE",
          "AI 解读暂时不可用，请稍后再试。",
          15,
        );
      }

      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new FortuneServiceError(
          502,
          "AI_UNAVAILABLE",
          "AI 解读暂时不可用，请稍后再试。",
          15,
        );
      }

      const text = parsed.data.choices[0]?.message.content.trim() ?? "";
      if (!text) {
        throw new FortuneServiceError(
          502,
          "AI_UNAVAILABLE",
          "AI 解读暂时不可用，请稍后再试。",
          15,
        );
      }

      const providerUsage: ProviderUsage | null = parsed.data.usage
        ? {
            completionTokens: parsed.data.usage.completion_tokens,
            promptCacheHitTokens:
              parsed.data.usage.prompt_cache_hit_tokens ?? 0,
            promptCacheMissTokens:
              parsed.data.usage.prompt_cache_miss_tokens ?? 0,
            promptTokens: parsed.data.usage.prompt_tokens,
          }
        : null;

      return {
        text,
        usage: providerUsage
          ? {
              completionTokens: providerUsage.completionTokens,
              costNanoUsd: calculateActualCostNanoUsd(
                providerUsage,
                this.config,
              ),
              promptCacheHitTokens: providerUsage.promptCacheHitTokens,
              promptCacheMissTokens:
                providerUsage.promptCacheMissTokens + Math.max(
                  0,
                  providerUsage.promptTokens -
                    providerUsage.promptCacheHitTokens -
                    providerUsage.promptCacheMissTokens,
                ),
            }
          : null,
      };
    } catch (error) {
      if (error instanceof FortuneServiceError) throw error;
      throw new FortuneServiceError(
        504,
        "AI_UNAVAILABLE",
        "AI 解读请求超时，请稍后再试。",
        15,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
