import { resolve } from "node:path";

export interface FortuneAiConfig {
  apiKey: string;
  authBaseUrl: string;
  authCacheMax: number;
  authCacheTtlMs: number;
  bodyLimitBytes: number;
  cacheMax: number;
  cacheTtlMs: number;
  dailyBudgetNanoUsd: number;
  databasePath: string;
  enabled: boolean;
  globalConcurrency: number;
  host: string;
  inputCacheHitUsdPerMillion: number;
  inputCacheMissUsdPerMillion: number;
  model: string;
  outputUsdPerMillion: number;
  perUserDailyLimit: number;
  perUserMinuteLimit: number;
  port: number;
  providerBaseUrl: string;
  providerTimeoutMs: number;
  timeZone: string;
}

function readPositiveNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = Number(env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeBaseUrl(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\/+$/u, "");

  return normalized || fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): FortuneAiConfig {
  const dailyBudgetUsd = readPositiveNumber(
    env,
    "FORTUNE_DAILY_BUDGET_USD",
    0.625,
  );

  return {
    apiKey: env.DEEPSEEK_API_KEY?.trim() ?? "",
    authBaseUrl: normalizeBaseUrl(
      env.FORTUNE_AUTH_BASE_URL ?? "",
      "http://127.0.0.1:3250",
    ),
    authCacheMax: Math.floor(
      readPositiveNumber(env, "FORTUNE_AUTH_CACHE_MAX", 256),
    ),
    authCacheTtlMs: Math.floor(
      readPositiveNumber(env, "FORTUNE_AUTH_CACHE_TTL_MS", 15_000),
    ),
    bodyLimitBytes: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_BODY_LIMIT_BYTES", 16 * 1024),
    ),
    cacheMax: Math.floor(readPositiveNumber(env, "FORTUNE_AI_CACHE_MAX", 256)),
    cacheTtlMs: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_CACHE_TTL_MS", 10 * 60 * 1000),
    ),
    dailyBudgetNanoUsd: Math.floor(dailyBudgetUsd * 1_000_000_000),
    databasePath: resolve(
      env.FORTUNE_AI_DATABASE_PATH?.trim() ||
        "/var/lib/gluepudding-fortune-ai/usage.sqlite3",
    ),
    enabled:
      env.FORTUNE_AI_ENABLED === "true" ||
      env.VITE_FORTUNE_AI_API === "true",
    globalConcurrency: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_GLOBAL_CONCURRENCY", 2),
    ),
    host: env.FORTUNE_AI_HOST?.trim() || "127.0.0.1",
    inputCacheHitUsdPerMillion: readPositiveNumber(
      env,
      "DEEPSEEK_INPUT_CACHE_HIT_USD_PER_MILLION",
      0.0028,
    ),
    inputCacheMissUsdPerMillion: readPositiveNumber(
      env,
      "DEEPSEEK_INPUT_CACHE_MISS_USD_PER_MILLION",
      0.14,
    ),
    model: env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash",
    outputUsdPerMillion: readPositiveNumber(
      env,
      "DEEPSEEK_OUTPUT_USD_PER_MILLION",
      0.28,
    ),
    perUserDailyLimit: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_PER_USER_DAILY_LIMIT", 20),
    ),
    perUserMinuteLimit: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_PER_USER_MINUTE_LIMIT", 3),
    ),
    port: Math.floor(readPositiveNumber(env, "FORTUNE_AI_PORT", 3260)),
    providerBaseUrl: normalizeBaseUrl(
      env.DEEPSEEK_BASE_URL ?? "",
      "https://api.deepseek.com/v1",
    ),
    providerTimeoutMs: Math.floor(
      readPositiveNumber(env, "FORTUNE_AI_TIMEOUT_MS", 30_000),
    ),
    timeZone: env.FORTUNE_AI_TIME_ZONE?.trim() || "Asia/Shanghai",
  };
}
