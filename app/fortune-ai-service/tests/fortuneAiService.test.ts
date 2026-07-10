import assert from "node:assert/strict";
import test from "node:test";
import type { AuthUser } from "../src/authClient.js";
import { readConfig } from "../src/config.js";
import type { FortuneAiRequest } from "../src/contracts.js";
import { FortuneServiceError } from "../src/errors.js";
import { loadFortuneData } from "../src/fortuneData.js";
import { FortuneAiService } from "../src/fortuneAiService.js";
import type {
  CompletionProvider,
  ProviderResult,
} from "../src/providerClient.js";
import { PerUserMinuteLimiter } from "../src/rateLimiter.js";
import { UsageStore } from "../src/usageStore.js";

const adminUser: AuthUser = {
  displayName: "Admin",
  id: "admin-id",
  roles: ["admin"],
  username: "admin",
};

const normalUser: AuthUser = {
  displayName: "User",
  id: "user-id",
  roles: [],
  username: "user",
};

function tarotRequest(index: number): FortuneAiRequest {
  return {
    cards: [{ index: index % 22, isUpright: true, position: "single" }],
    deck: "major",
    question: `question-${index}`,
    spread: "single",
  };
}

class FakeProvider implements CompletionProvider {
  calls = 0;
  gate: Promise<void> | null = null;

  async complete(): Promise<ProviderResult> {
    this.calls += 1;
    if (this.gate) await this.gate;
    return {
      text: `result-${this.calls}`,
      usage: {
        completionTokens: 10,
        costNanoUsd: 100,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 10,
      },
    };
  }
}

function createService(provider: CompletionProvider) {
  const config = readConfig({
    FORTUNE_AI_CACHE_MAX: "256",
    FORTUNE_AI_ENABLED: "true",
    FORTUNE_AI_GLOBAL_CONCURRENCY: "2",
    FORTUNE_AI_PER_USER_DAILY_LIMIT: "1000",
    FORTUNE_AI_PER_USER_MINUTE_LIMIT: "1000",
    FORTUNE_DAILY_BUDGET_USD: "10",
  });
  const store = new UsageStore(":memory:");
  return {
    service: new FortuneAiService(
      config,
      loadFortuneData(),
      provider,
      new PerUserMinuteLimiter(config.perUserMinuteLimit),
      store,
    ),
    store,
  };
}

test("admin cache remains bounded after unique questions", async () => {
  const provider = new FakeProvider();
  const { service, store } = createService(provider);
  try {
    for (let index = 0; index < 300; index += 1) {
      await service.interpret({
        accessClass: "admin",
        module: "tarot",
        request: tarotRequest(index),
        requestId: `request-${index}`,
        user: adminUser,
      });
    }
    assert.equal(service.getCacheSizes().admin, 256);
  } finally {
    store.close();
  }
});

test("identical in-flight requests are coalesced", async () => {
  const provider = new FakeProvider();
  let release = () => {};
  provider.gate = new Promise<void>((resolve) => { release = resolve; });
  const { service, store } = createService(provider);
  try {
    const context = {
      accessClass: "admin" as const,
      module: "tarot" as const,
      request: tarotRequest(1),
      user: adminUser,
    };
    const first = service.interpret({ ...context, requestId: "first" });
    const second = service.interpret({ ...context, requestId: "second" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(provider.calls, 1);
    release();
    await Promise.all([first, second]);
  } finally {
    store.close();
  }
});

test("normal requests reject work beyond global concurrency", async () => {
  const provider = new FakeProvider();
  let release = () => {};
  provider.gate = new Promise<void>((resolve) => { release = resolve; });
  const { service, store } = createService(provider);
  try {
    const call = (index: number) => service.interpret({
      accessClass: "normal",
      module: "tarot",
      request: tarotRequest(index),
      requestId: `normal-${index}`,
      user: normalUser,
    });
    const first = call(1);
    const second = call(2);
    await assert.rejects(call(3), (error: unknown) =>
      error instanceof FortuneServiceError && error.code === "BUSY");
    release();
    await Promise.all([first, second]);
  } finally {
    store.close();
  }
});
