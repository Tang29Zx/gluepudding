import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";
import { z } from "zod";
import type { FortuneAiConfig } from "./config.js";
import { FortuneServiceError } from "./errors.js";

const authUserSchema = z.object({
  displayName: z.string(),
  id: z.string().min(1),
  roles: z.array(z.string()),
  username: z.string(),
}).passthrough();

const authResponseSchema = z.object({
  ok: z.literal(true),
  user: authUserSchema,
}).passthrough();

export type AuthUser = z.infer<typeof authUserSchema>;

export interface SessionAuthenticator {
  authenticate(cookie: string): Promise<AuthUser | null>;
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AuthClient implements SessionAuthenticator {
  private readonly cache: LRUCache<string, AuthUser>;

  constructor(private readonly config: FortuneAiConfig) {
    this.cache = new LRUCache({
      max: config.authCacheMax,
      ttl: config.authCacheTtlMs,
    });
  }

  async authenticate(cookie: string): Promise<AuthUser | null> {
    if (!cookie || Buffer.byteLength(cookie, "utf8") > 8192) {
      return null;
    }

    const cacheKey = hashIdentifier(cookie);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let response: Response;
    try {
      response = await fetch(`${this.config.authBaseUrl}/api/auth/session`, {
        headers: {
          Accept: "application/json",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new FortuneServiceError(
        503,
        "AI_UNAVAILABLE",
        "登录服务暂时不可用，请稍后再试。",
        5,
      );
    }

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new FortuneServiceError(
        503,
        "AI_UNAVAILABLE",
        "登录服务暂时不可用，请稍后再试。",
        5,
      );
    }

    let input: unknown;
    try {
      input = await response.json();
    } catch {
      throw new FortuneServiceError(
        503,
        "AI_UNAVAILABLE",
        "登录服务返回异常，请稍后再试。",
        5,
      );
    }

    const parsed = authResponseSchema.safeParse(input);
    if (!parsed.success) {
      throw new FortuneServiceError(
        503,
        "AI_UNAVAILABLE",
        "登录服务返回异常，请稍后再试。",
        5,
      );
    }

    this.cache.set(cacheKey, parsed.data.user);
    return parsed.data.user;
  }
}
