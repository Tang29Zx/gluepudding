import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import type { SessionAuthenticator } from "./authClient.js";
import type { FortuneAiConfig } from "./config.js";
import {
  getFortuneRoute,
  parseFortuneRequest,
  type FortuneApiErrorCode,
} from "./contracts.js";
import { getDayKey } from "./day.js";
import { FortuneServiceError } from "./errors.js";
import type { FortuneInterpreter } from "./fortuneAiService.js";
import type { UsageStore } from "./usageStore.js";

interface ApiErrorBody {
  code: FortuneApiErrorCode;
  error: string;
  module: "health" | "iching" | "tarot";
  retryAfterSeconds?: number;
  success: false;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  retryAfterSeconds?: number,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", Buffer.byteLength(payload));
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (retryAfterSeconds !== undefined) {
    response.setHeader("Retry-After", String(retryAfterSeconds));
  }
  response.end(payload);
}

function sendApiError(
  response: ServerResponse,
  module: "health" | "iching" | "tarot",
  error: FortuneServiceError,
): void {
  const body: ApiErrorBody = {
    code: error.code,
    error: error.message,
    module,
    success: false,
    ...(error.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: error.retryAfterSeconds }),
  };
  sendJson(response, error.statusCode, body, error.retryAfterSeconds);
}

async function readJsonBody(
  request: IncomingMessage,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new FortuneServiceError(
      400,
      "INVALID_REQUEST",
      "请求必须使用 application/json。",
    );
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new FortuneServiceError(
        413,
        "INVALID_REQUEST",
        "请求内容过大。",
      );
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new FortuneServiceError(
      400,
      "INVALID_REQUEST",
      "请求内容不能为空。",
    );
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new FortuneServiceError(
      400,
      "INVALID_REQUEST",
      "请求 JSON 格式无效。",
    );
  }
}

function getPathname(request: IncomingMessage): string {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

export function createFortuneAiHttpServer(dependencies: {
  authClient: SessionAuthenticator;
  config: FortuneAiConfig;
  service: FortuneInterpreter;
  usageStore: UsageStore;
}) {
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader("X-Request-Id", requestId);
    const pathname = getPathname(request);

    if (request.method === "GET" && pathname === "/api/fortune/health") {
      sendJson(response, 200, {
        data: {
          modules: ["tarot", "iching"],
          status: "ok",
          version: "2",
        },
        module: "health",
        success: true,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/internal/health") {
      sendJson(response, 200, {
        cache: dependencies.service.getCacheSizes(),
        service: "fortune-ai",
        status: dependencies.config.enabled && dependencies.config.apiKey
          ? "ok"
          : "ai-disabled",
      });
      return;
    }

    if (request.method === "GET" && pathname === "/internal/usage") {
      const day = getDayKey(new Date(), dependencies.config.timeZone);
      sendJson(response, 200, dependencies.usageStore.getUsage(day));
      return;
    }

    const route = getFortuneRoute(pathname);
    if (!route) {
      sendJson(response, 404, {
        code: "INVALID_REQUEST",
        error: "not found",
        module: "health",
        success: false,
      });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, {
        code: "INVALID_REQUEST",
        error: "method not allowed",
        module: route.module,
        success: false,
      });
      return;
    }

    try {
      const user = await dependencies.authClient.authenticate(
        request.headers.cookie ?? "",
      );
      if (!user) {
        throw new FortuneServiceError(
          401,
          "AUTH_REQUIRED",
          "请先登录后使用 AI 解读。",
        );
      }

      if (
        route.accessClass === "admin" &&
        !user.roles.map((role) => role.toLowerCase()).includes("admin")
      ) {
        throw new FortuneServiceError(
          403,
          "FORBIDDEN",
          "当前账号没有 Admin 权限。",
        );
      }

      const input = await readJsonBody(
        request,
        dependencies.config.bodyLimitBytes,
      );
      const parsedRequest = parseFortuneRequest(route.module, input);
      const interpretation = await dependencies.service.interpret({
        accessClass: route.accessClass,
        module: route.module,
        request: parsedRequest,
        requestId,
        user,
      });

      sendJson(response, 200, {
        data: interpretation,
        module: route.module,
        success: true,
      });
    } catch (error) {
      const serviceError = error instanceof FortuneServiceError
        ? error
        : error instanceof ZodError
          ? new FortuneServiceError(
              400,
              "INVALID_REQUEST",
              "请求字段无效。",
            )
          : new FortuneServiceError(
              500,
              "AI_UNAVAILABLE",
              "AI 解读暂时不可用，请稍后再试。",
            );

      console.warn(JSON.stringify({
        code: serviceError.code,
        module: route.module,
        requestId,
        statusCode: serviceError.statusCode,
      }));
      sendApiError(response, route.module, serviceError);
    }
  });
}
