import { createHash, randomUUID } from "node:crypto";
import { LRUCache } from "lru-cache";
import type { AuthUser } from "./authClient.js";
import type { FortuneAiConfig } from "./config.js";
import type {
  FortuneAccessClass,
  FortuneAiModule,
  FortuneAiRequest,
} from "./contracts.js";
import { calculateReservationNanoUsd } from "./cost.js";
import { getDayKey, getSecondsUntilNextDay } from "./day.js";
import { FortuneServiceError } from "./errors.js";
import type { FortuneData } from "./fortuneData.js";
import { buildPrompt } from "./prompts.js";
import type { CompletionProvider, ProviderResult } from "./providerClient.js";
import type { PerUserMinuteLimiter } from "./rateLimiter.js";
import type { UsageStore } from "./usageStore.js";

interface RequestContext {
  accessClass: FortuneAccessClass;
  module: FortuneAiModule;
  request: FortuneAiRequest;
  requestId: string;
  user: AuthUser;
}

export interface FortuneInterpretation {
  interpretation: string;
  source: "ai";
}

export interface FortuneInterpreter {
  getCacheSizes(): { admin: number; normal: number };
  interpret(context: RequestContext): Promise<FortuneInterpretation>;
}

export class FortuneAiService implements FortuneInterpreter {
  private readonly adminCache: LRUCache<string, string>;
  private readonly adminInFlight = new Map<string, Promise<ProviderResult>>();
  private normalActiveRequests = 0;
  private readonly normalCache: LRUCache<string, string>;
  private readonly normalInFlight = new Map<string, Promise<ProviderResult>>();

  constructor(
    private readonly config: FortuneAiConfig,
    private readonly data: FortuneData,
    private readonly provider: CompletionProvider,
    private readonly rateLimiter: PerUserMinuteLimiter,
    private readonly usageStore: UsageStore,
  ) {
    const options = { max: config.cacheMax, ttl: config.cacheTtlMs };
    this.adminCache = new LRUCache(options);
    this.normalCache = new LRUCache(options);
  }

  async interpret(context: RequestContext): Promise<FortuneInterpretation> {
    const userHash = createHash("sha256").update(context.user.id).digest("hex");
    const day = getDayKey(new Date(), this.config.timeZone);
    const cacheKey = createHash("sha256")
      .update(context.module)
      .update("\0")
      .update(JSON.stringify(context.request))
      .digest("hex");
    const cache = context.accessClass === "admin"
      ? this.adminCache
      : this.normalCache;
    const inFlight = context.accessClass === "admin"
      ? this.adminInFlight
      : this.normalInFlight;

    if (context.accessClass === "normal") {
      this.enforceNormalUserLimits(day, userHash);
    }

    const cached = cache.get(cacheKey);
    if (cached) {
      this.audit(context, day, userHash, "cache_hit", 0);
      return { interpretation: cached, source: "ai" };
    }

    const existing = inFlight.get(cacheKey);
    if (existing) {
      const result = await existing;
      this.audit(context, day, userHash, "coalesced", 0);
      return { interpretation: result.text, source: "ai" };
    }

    const prompt = buildPrompt(context.module, context.request, this.data);
    const providerUserId = userHash;
    let reservationId: string | null = null;

    if (context.accessClass === "normal") {
      if (this.normalActiveRequests >= this.config.globalConcurrency) {
        throw new FortuneServiceError(
          429,
          "BUSY",
          "AI 解读请求较多，请稍后再试。",
          5,
        );
      }

      const reservationAmount = calculateReservationNanoUsd(
        prompt.messages,
        prompt.maxTokens,
        this.config,
      );
      reservationId = randomUUID();
      if (!this.usageStore.reserveBudget(
        reservationId,
        day,
        reservationAmount,
        this.config.dailyBudgetNanoUsd,
      )) {
        throw new FortuneServiceError(
          503,
          "DAILY_BUDGET_EXHAUSTED",
          "今日 AI 解读额度已用完，请明天再试。",
          getSecondsUntilNextDay(new Date(), this.config.timeZone),
        );
      }

      this.normalActiveRequests += 1;
    }

    const requestPromise = this.provider.complete(prompt, providerUserId);
    inFlight.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      cache.set(cacheKey, result.text);

      if (context.accessClass === "normal" && reservationId) {
        this.usageStore.settleReservation(reservationId, result.usage);
      } else {
        this.usageStore.recordAdminUsage(day, result.usage);
      }

      this.audit(
        context,
        day,
        userHash,
        "upstream_success",
        result.usage?.costNanoUsd ?? 0,
      );
      return { interpretation: result.text, source: "ai" };
    } catch (error) {
      if (context.accessClass === "normal" && reservationId) {
        this.usageStore.settleReservation(reservationId, null);
      } else {
        this.usageStore.recordAdminUsage(day, null);
      }
      this.audit(context, day, userHash, "upstream_error", 0);
      throw error;
    } finally {
      inFlight.delete(cacheKey);
      if (context.accessClass === "normal") {
        this.normalActiveRequests = Math.max(0, this.normalActiveRequests - 1);
      }
    }
  }

  getCacheSizes(): { admin: number; normal: number } {
    return {
      admin: this.adminCache.size,
      normal: this.normalCache.size,
    };
  }

  private enforceNormalUserLimits(day: string, userHash: string): void {
    if (!this.rateLimiter.consume(userHash)) {
      throw new FortuneServiceError(
        429,
        "RATE_LIMITED",
        "AI 解读请求过于频繁，请稍后再试。",
        20,
      );
    }

    if (!this.usageStore.consumeUserDailyLimit(
      day,
      userHash,
      this.config.perUserDailyLimit,
    )) {
      throw new FortuneServiceError(
        429,
        "RATE_LIMITED",
        "今日个人 AI 解读次数已用完。",
        getSecondsUntilNextDay(new Date(), this.config.timeZone),
      );
    }
  }

  private audit(
    context: RequestContext,
    day: string,
    userHash: string,
    status: string,
    costNanoUsd: number,
  ): void {
    this.usageStore.appendAudit({
      accessClass: context.accessClass,
      costNanoUsd,
      day,
      module: context.module,
      requestId: context.requestId,
      status,
      userHash,
    });
  }
}
