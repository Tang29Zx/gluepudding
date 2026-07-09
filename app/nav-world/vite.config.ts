import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const FORTUNE_AI_TIMEOUT_MS = 30_000;
const MAX_FORTUNE_AI_BODY_BYTES = 64 * 1024;

type FortuneAiModule = "tarot" | "iching";
type FortuneAiEnv = Record<string, string | undefined>;

interface FortuneAiConfig {
  apiKey: string;
  baseUrl: string;
  isEnabled: boolean;
  model: string;
}

interface ChatCompletionMessage {
  role: "system" | "user";
  content: string;
}

const fortuneAiMaxTokens: Record<FortuneAiModule, number> = {
  tarot: 760,
  iching: 650,
};

function normalizeOpenAiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/u, "");
  if (!trimmed) return DEFAULT_DEEPSEEK_BASE_URL;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function readFortuneAiConfig(env: FortuneAiEnv): FortuneAiConfig {
  return {
    apiKey: env.DEEPSEEK_API_KEY?.trim() ?? "",
    baseUrl: normalizeOpenAiBaseUrl(env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_BASE_URL),
    isEnabled: env.VITE_FORTUNE_AI_API === "true",
    model: env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
  };
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function sendFortuneAiError(
  res: ServerResponse,
  module: FortuneAiModule,
  error = "AI 解读暂时不可用，请稍后再试。",
): void {
  sendJson(res, 200, { module, success: false, error });
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > MAX_FORTUNE_AI_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asDisplayText(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function buildTarotPrompt(params: Record<string, unknown>): ChatCompletionMessage[] {
  const question = asText(params.question, "未提供具体问题");
  const spread = asText(params.spread, "three_card");
  const deck = asText(params.deck, "major");
  const cards = Array.isArray(params.cards)
    ? params.cards.map((card, index) => {
        const data = asRecord(card);
        const name = asText(data.name, `第${index + 1}张牌`);
        const position = asText(data.position, `位置${index + 1}`);
        const orientation = data.isUpright === false ? "逆位" : "正位";
        const keywords = Array.isArray(data.keywords)
          ? data.keywords.filter((keyword): keyword is string => typeof keyword === "string").join("、")
          : "";
        const meaning = asText(data.meaning);
        return `${position}：${name}（${orientation}）${keywords ? `，关键词：${keywords}` : ""}${meaning ? `，牌义：${meaning}` : ""}`;
      }).join("\n")
    : "未提供牌面。";

  return [
    {
      role: "system",
      content:
        "你是占卜屋里的中文塔罗解读师。请用温柔、神秘但清晰的语气回答，结合牌阵和用户问题给出娱乐性质的启发。不要做医学、法律、投资等确定性承诺。输出必须适合世界内大屏阅读。",
    },
    {
      role: "user",
      content: [
        `用户问题：${question}`,
        `牌阵：${spread}`,
        `牌组：${deck}`,
        "抽到的牌：",
        cards,
        "请输出 4 段以内、430 到 600 个中文字。不要使用 Markdown、标题、编号、项目符号或加粗符号。最后用一句短句提醒“以上解读仅供娱乐参考”。",
      ].join("\n"),
    },
  ];
}

function buildIchingPrompt(params: Record<string, unknown>): ChatCompletionMessage[] {
  const question = asText(params.question, "未提供具体问题");
  const original = asRecord(params.originalHexagram);
  const changed = asRecord(params.changedHexagram);
  const changingLines = Array.isArray(params.changingLines)
    ? params.changingLines.filter((line): line is number => typeof line === "number")
    : [];
  const changedName = asText(changed.name, "无变卦");

  return [
    {
      role: "system",
      content:
        "你是占卜屋里的中文周易解读师。请用温和、克制、有古典感但易懂的语气回答，结合卦象、变爻和问题给出娱乐性质的启发。不要做医学、法律、投资等确定性承诺。输出必须适合世界内大屏阅读。",
    },
    {
      role: "user",
      content: [
        `用户问题：${question}`,
        `本卦：第${asDisplayText(original.number, "?")}卦 ${asText(original.name, "未知")} ${asText(original.symbol)}`,
        `本卦说明：${asText(original.description, "无")}`,
        `变卦：${changedName}${changedName !== "无变卦" ? ` ${asText(changed.symbol)}` : ""}`,
        `变卦说明：${changedName !== "无变卦" ? asText(changed.description, "无") : "无变爻，卦象稳定。"}`,
        `变爻：${changingLines.length > 0 ? changingLines.join("、") : "无"}`,
        "请输出 4 段以内、360 到 530 个中文字。第一段概括卦象，第二段结合问题，第三段说明变化趋势，第四段给行动建议；不要逐条展开每一爻。不要使用 Markdown、标题、编号、项目符号或加粗符号。最后用一句短句提醒“以上解读仅供娱乐参考”。",
      ].join("\n"),
    },
  ];
}

function extractChatCompletionText(responseBody: unknown): string {
  const data = asRecord(responseBody);
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice.message);
  return asText(message.content);
}

async function requestFortuneAi(
  config: FortuneAiConfig,
  messages: ChatCompletionMessage[],
  maxTokens: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORTUNE_AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.68,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API returned HTTP ${response.status}`);
    }

    const responseBody: unknown = await response.json();
    const text = extractChatCompletionText(responseBody);
    if (!text) {
      throw new Error("DeepSeek API returned an empty completion");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function createFortuneAiProxyPlugin(config: FortuneAiConfig): PluginOption {
  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    const path = req.url?.split("?")[0] ?? "";

    if (path === "/api/fortune/health") {
      sendJson(res, 200, {
        module: "health",
        success: true,
        data: {
          status: config.isEnabled && config.apiKey ? "ok" : "ai-disabled",
          version: `deepseek:${config.model}`,
          modules: ["zodiac", "tarot", "iching"],
        },
      });
      return;
    }

    const module: FortuneAiModule | null =
      path === "/api/fortune/tarot/ai"
        ? "tarot"
        : path === "/api/fortune/iching/ai"
          ? "iching"
          : null;

    if (!module) {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { module, success: false, error: "method not allowed" });
      return;
    }

    if (!config.isEnabled) {
      sendFortuneAiError(res, module, "AI 解读接口未启用。");
      return;
    }

    if (!config.apiKey) {
      sendFortuneAiError(res, module, "AI 解读接口缺少服务端密钥。");
      return;
    }

    try {
      const params = asRecord(await readJsonBody(req));
      const messages = module === "tarot"
        ? buildTarotPrompt(params)
        : buildIchingPrompt(params);
      const interpretation = await requestFortuneAi(
        config,
        messages,
        fortuneAiMaxTokens[module],
      );

      sendJson(res, 200, {
        module,
        success: true,
        data: { interpretation, source: "ai" },
      });
    } catch (error) {
      console.warn(
        "Fortune AI request failed.",
        error instanceof Error ? error.message : String(error),
      );
      sendFortuneAiError(res, module);
    }
  }

  return {
    name: "fortune-ai-proxy",
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}

function preloadWorldExperienceChunk(): PluginOption {
  return {
    name: "preload-world-experience-chunk",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const worldChunk = Object.values(context.bundle ?? {}).find(
          (outputItem) =>
            outputItem.type === "chunk" &&
            outputItem.facadeModuleId?.endsWith("/src/world/WorldExperience.tsx"),
        );

        if (!worldChunk) {
          return [];
        }

        return [
          {
            tag: "link",
            injectTo: "head-prepend",
            attrs: {
              rel: "modulepreload",
              crossorigin: true,
              href: `./${worldChunk.fileName}`,
            },
          },
        ];
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, ".", ""),
  };
  const fortuneAiConfig = readFortuneAiConfig(env);

  return {
    base: "./",
    plugins: [
      react(),
      createFortuneAiProxyPlugin(fortuneAiConfig),
      preloadWorldExperienceChunk(),
    ],
    build: {
      outDir: "../frontend",
      emptyOutDir: false,
    },
  };
});
