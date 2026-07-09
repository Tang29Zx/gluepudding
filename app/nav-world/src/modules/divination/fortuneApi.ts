// ============================================================
// 占卜屋 API 适配层
// 来源：resources/feature_implementation/src/adapters/fortuneApi.ts
// 支持 mock 模式和真实 API 模式切换
// 基础占卜通过 VITE_USE_MOCK 和 VITE_FORTUNE_API_BASE_URL 控制
// AI 解读通过 VITE_FORTUNE_AI_API 独立启用，避免基础 mock 被关闭
// ============================================================

import type {
  ApiResponse,
  ZodiacRequest,
  ZodiacResult,
  TarotRequest,
  TarotResult,
  TarotCardResult,
  IchingRequest,
  IchingResult,
  HealthResult,
  AiIchInterpretRequest,
  AiTarotRequest,
  AiInterpretResult,
} from './types';
import { ZODIAC_SIGN_NAMES } from './types';
import zodiacTextsData from './data/zodiac_texts.json';
import tarotCardsData from './data/tarot_cards.json';
import { getSignFromBirthday } from './business/zodiacLogic';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // 默认 mock 模式
const USE_AI_API = import.meta.env.VITE_FORTUNE_AI_API === 'true';
const API_BASE = import.meta.env.VITE_FORTUNE_API_BASE_URL || '';

// Type for the zodiac texts JSON structure
type ZodiacTextEntry = {
  overall: number;
  love: number;
  career: number;
  health: number;
  luckyColor: string;
  luckyNumber: number;
  good: string;
  bad: string;
  level: string;
  summary: string;
};

const zodiacTextsMap = zodiacTextsData as Record<
  string,
  { texts: ZodiacTextEntry[] }
>;

// --- Mock Zodiac Helper ---

function pickZodiacText(sign: string): ZodiacTextEntry {
  const signData = zodiacTextsMap[sign];
  if (!signData || !signData.texts || signData.texts.length === 0) {
    // fallback: return the first available text from any sign
    const firstSign = Object.keys(zodiacTextsMap)[0];
    const fallback = zodiacTextsMap[firstSign]?.texts?.[0];
    if (fallback) return fallback;
    // ultimate fallback
    return {
      overall: 80, love: 75, career: 85, health: 78,
      luckyColor: '金色', luckyNumber: 8,
      good: '积极行动', bad: '犹豫不决',
      level: '吉',
      summary: '今天是充满可能性的一天，保持积极心态。',
    };
  }
  // Pick a random variant (3 per sign), seeded by date for consistency
  const today = new Date().toISOString().slice(0, 10);
  const seed = today.split('-').reduce((a, b) => a + parseInt(b, 10), 0);
  const index = seed % signData.texts.length;
  return signData.texts[index];
}

function buildMockZodiacResult(sign: string, signName: string): ZodiacResult {
  const text = pickZodiacText(sign);
  return {
    sign: sign as ZodiacResult['sign'],
    signName,
    date: new Date().toISOString().slice(0, 10),
    overall: text.overall,
    love: text.love,
    career: text.career,
    health: text.health,
    luckyColor: text.luckyColor,
    luckyNumber: text.luckyNumber,
    good: text.good,
    bad: text.bad,
    level: text.level,
    summary: text.summary,
  };
}

function buildMockTarotResult(selectedIndexes: number[], spread: string): TarotResult {
  const shuffled = [...selectedIndexes].sort(() => Math.random() - 0.5);
  const positions: TarotCardResult['position'][] =
    spread === 'three_card' ? ['past', 'present', 'future'] : ['single'];
  const cards: TarotCardResult[] = shuffled.slice(0, positions.length).map((idx, i) => {
    const card = tarotCardsData.find((c) => c.id === idx) || tarotCardsData[0];
    const isUpright = Math.random() > 0.4;
    const meaning = isUpright ? card.upright : card.reversed;
    return {
      index: card.id,
      name: card.name,
      nameEn: card.nameEn,
      isUpright,
      keywords: meaning.keywords,
      meaning: meaning.meaning,
      position: positions[i],
    };
  });
  return {
    spread: spread as TarotResult['spread'],
    deck: 'major',
    deckSize: 22,
    selectedIndexes: cards.map((c) => c.index),
    cards,
    summary: cards.map((c) => `${c.position === 'past' ? '过去' : c.position === 'present' ? '现在' : c.position === 'future' ? '未来' : ''}由${c.isUpright ? '' : '逆位'}"${c.name}"主导`).join('，') + '。',
  };
}

const mockIchingResult: IchingResult = {
  lines: [
    { position: 1, value: 7, isChanging: false, label: '少阳' },
    { position: 2, value: 8, isChanging: false, label: '少阴' },
    { position: 3, value: 9, isChanging: true, label: '老阳' },
    { position: 4, value: 7, isChanging: false, label: '少阳' },
    { position: 5, value: 8, isChanging: false, label: '少阴' },
    { position: 6, value: 7, isChanging: false, label: '少阳' },
  ],
  originalHexagram: {
    code: '101011',
    number: 38,
    name: '火泽睽',
    symbol: '☲☱',
    description: '分歧背离。关系中存在分歧和误解。求同存异，小的分歧不妨碍大的合作。',
  },
  changedHexagram: {
    code: '001011',
    number: 54,
    name: '雷泽归妹',
    symbol: '☳☱',
    description: '结合归附。关系的确立和结合。注意关系中的不对等，保持自我价值。',
  },
  changingLines: [3],
  summary: '本卦为「火泽睽」：分歧背离。变爻：第3爻。变卦为「雷泽归妹」：综合来看，从睽到归妹的变化趋势预示着你关注的事情正在从分歧走向结合。',
};

// --- Request Helper ---

class FortuneApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'FortuneApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      throw new FortuneApiError(`HTTP ${response.status}`, response.status);
    }

    const json: ApiResponse<T> = await response.json();
    return json;
  } catch (err) {
    if (err instanceof FortuneApiError) throw err;
    throw new FortuneApiError('无法连接到占卜服务，请检查网络或稍后重试');
  }
}

// --- API Functions ---

export async function getFortuneHealth(): Promise<ApiResponse<HealthResult>> {
  if (USE_MOCK) {
    return {
      module: 'health',
      success: true,
      data: { status: 'ok', version: '1.0.0-mock', modules: ['zodiac', 'tarot', 'iching'] },
    };
  }
  return request<HealthResult>(`${API_BASE}/api/fortune/health`);
}

export async function getZodiacFortune(params: ZodiacRequest): Promise<ApiResponse<ZodiacResult>> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600));

    // Resolve the target sign from params
    const resolvedSign = params.sign || (params.birthday ? getSignFromBirthday(params.birthday) : null);
    if (!resolvedSign) {
      return { module: 'zodiac', success: false, error: 'birthday or sign is required' };
    }

    const signName = ZODIAC_SIGN_NAMES[resolvedSign] || resolvedSign;
    const result = buildMockZodiacResult(resolvedSign, signName);
    return { module: 'zodiac', success: true, data: result };
  }

  return request<ZodiacResult>(`${API_BASE}/api/fortune/zodiac`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getTarotReading(params: TarotRequest): Promise<ApiResponse<TarotResult>> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));

    if (!['single', 'three_card'].includes(params.spread)) {
      return { module: 'tarot', success: false, error: `invalid spread: ${params.spread}` };
    }

    const indexes = params.selectedIndexes || [];
    const result = buildMockTarotResult(indexes, params.spread);
    return { module: 'tarot', success: true, data: result };
  }

  return request<TarotResult>(`${API_BASE}/api/fortune/tarot`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getIchingReading(params: IchingRequest): Promise<ApiResponse<IchingResult>> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1000));
    return { module: 'iching', success: true, data: { ...mockIchingResult } };
  }

  return request<IchingResult>(`${API_BASE}/api/fortune/iching`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getIchingAiReading(
  params: AiIchInterpretRequest
): Promise<ApiResponse<AiInterpretResult>> {
  if (!USE_AI_API) {
    await new Promise((r) => setTimeout(r, 2000));
    return {
      module: 'iching',
      success: true,
      data: {
        interpretation: `【AI 模拟解读】

根据卦象「${params.originalHexagram.name}」的启示，结合你提出的问题，当前局势需要审慎对待。${
  params.changingLines.length > 0
    ? `第${params.changingLines.join('、')}爻的变化暗示着转机正在酝酿。`
    : '卦象稳定，近期不会有太大变化。'
}

建议保持耐心，顺势而为，不要强求。变数之中自有定数，定数之中亦有转机。

以上解读仅供娱乐参考。`,
        source: 'ai',
      },
    };
  }

  return request<AiInterpretResult>(`${API_BASE}/api/fortune/iching/ai`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getTarotAiReading(
  params: AiTarotRequest
): Promise<ApiResponse<AiInterpretResult>> {
  if (!USE_AI_API) {
    await new Promise((r) => setTimeout(r, 2000));
    const cardList = params.cards.map(
      (c) => `${c.name}（${c.isUpright ? '正位' : '逆位'}）`
    ).join('、');
    return {
      module: 'tarot',
      success: true,
      data: {
        interpretation: `【AI 模拟解读】

你抽到了${cardList}。这个牌阵揭示了你当前所处的情境，每张牌都在各自的位置上传递着独特的讯息。

结合你提出的问题，这张牌阵整体传递出一种积极的信号。过去的影响正在转化为当下的力量，而未来指向更清晰的方向。

建议保持开放的心态，关注内在的直觉。答案已经在你心中，塔罗只是映照你内心的一面镜子。

以上解读仅供娱乐参考。`,
        source: 'ai',
      },
    };
  }

  return request<AiInterpretResult>(`${API_BASE}/api/fortune/tarot/ai`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
