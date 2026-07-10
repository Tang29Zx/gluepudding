import type {
  FortuneAiModule,
  FortuneAiRequest,
  IchingAiRequest,
  TarotAiRequest,
} from "./contracts.js";
import type { FortuneData } from "./fortuneData.js";

export interface ChatCompletionMessage {
  content: string;
  role: "system" | "user";
}

export interface BuiltPrompt {
  maxTokens: number;
  messages: ChatCompletionMessage[];
}

function requireTarotCard(data: FortuneData, id: number) {
  const card = data.tarotCardsById.get(id);
  if (!card) throw new Error("Trusted tarot data is incomplete");
  return card;
}

function requireHexagram(data: FortuneData, number: number) {
  const hexagram = data.hexagramsByNumber.get(number);
  if (!hexagram) throw new Error("Trusted iching data is incomplete");
  return hexagram;
}

function buildTarotPrompt(
  request: TarotAiRequest,
  data: FortuneData,
): BuiltPrompt {
  const cards = request.cards.map((selection) => {
    const card = requireTarotCard(data, selection.index);
    const meaning = selection.isUpright ? card.upright : card.reversed;
    const orientation = selection.isUpright ? "正位" : "逆位";

    return `${selection.position}：${card.name}（${orientation}），关键词：${meaning.keywords.join("、")}，牌义：${meaning.meaning}`;
  }).join("\n");

  return {
    maxTokens: 760,
    messages: [
      {
        role: "system",
        content:
          "你是占卜屋里的中文塔罗解读师。请用温柔、神秘但清晰的语气回答，结合牌阵和用户问题给出娱乐性质的启发。不要做医学、法律、投资等确定性承诺。输出必须适合世界内大屏阅读。",
      },
      {
        role: "user",
        content: [
          `用户问题：${request.question}`,
          `牌阵：${request.spread}`,
          `牌组：${request.deck}`,
          "抽到的牌：",
          cards,
          "请输出 4 段以内、430 到 600 个中文字。不要使用 Markdown、标题、编号、项目符号或加粗符号。最后用一句短句提醒“以上解读仅供娱乐参考”。",
        ].join("\n"),
      },
    ],
  };
}

function buildIchingPrompt(
  request: IchingAiRequest,
  data: FortuneData,
): BuiltPrompt {
  const original = requireHexagram(data, request.originalNumber);
  const changed = request.changedNumber === null
    ? null
    : requireHexagram(data, request.changedNumber);

  return {
    maxTokens: 360,
    messages: [
      {
        role: "system",
        content:
          "你是占卜屋里的中文周易解读师。请用温和、克制、有古典感但易懂的语气回答，结合卦象、变爻和问题给出娱乐性质的启发。不要做医学、法律、投资等确定性承诺。输出必须适合世界内大屏阅读。",
      },
      {
        role: "user",
        content: [
          `用户问题：${request.question}`,
          `本卦：第${original.number}卦 ${original.name} ${original.symbol}`,
          `本卦说明：${original.description}`,
          `变卦：${changed ? `${changed.name} ${changed.symbol}` : "无变卦"}`,
          `变卦说明：${changed ? changed.description : "无变爻，卦象稳定。"}`,
          `变爻：${request.changingLines.length > 0 ? request.changingLines.join("、") : "无"}`,
          "请输出 2 到 3 段、220 到 320 个中文字。先概括卦象，再结合问题说明趋势和行动建议；不要逐条展开每一爻。不要使用 Markdown、标题、编号、项目符号或加粗符号。最后用一句短句提醒“以上解读仅供娱乐参考”。",
        ].join("\n"),
      },
    ],
  };
}

export function buildPrompt(
  module: FortuneAiModule,
  request: FortuneAiRequest,
  data: FortuneData,
): BuiltPrompt {
  return module === "tarot"
    ? buildTarotPrompt(request as TarotAiRequest, data)
    : buildIchingPrompt(request as IchingAiRequest, data);
}
