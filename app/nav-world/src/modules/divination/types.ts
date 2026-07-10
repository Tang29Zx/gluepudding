// ============================================================
// 占卜屋模块统一类型定义
// 来源：resources/feature-implementation/src/types/fortuneTypes.ts
// 迁移到 3D 大世界 modules/divination/types.ts
// 100% 复用，未改动任何类型定义
// ============================================================

// --- 通用 ---

export type FortuneModule = 'zodiac' | 'tarot' | 'iching';
export type HealthModule = 'health';
export type AnyModule = FortuneModule | HealthModule;

export interface ApiResponse<T> {
  code?: FortuneApiErrorCode;
  module: AnyModule;
  success: boolean;
  data?: T;
  error?: string;
  retryAfterSeconds?: number;
}

export type FortuneApiErrorCode =
  | "AI_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "BUSY"
  | "DAILY_BUDGET_EXHAUSTED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "RATE_LIMITED";

// --- 星座 ---

export type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export const ZODIAC_SIGN_NAMES: Record<ZodiacSign, string> = {
  aries: '白羊座',
  taurus: '金牛座',
  gemini: '双子座',
  cancer: '巨蟹座',
  leo: '狮子座',
  virgo: '处女座',
  libra: '天秤座',
  scorpio: '天蝎座',
  sagittarius: '射手座',
  capricorn: '摩羯座',
  aquarius: '水瓶座',
  pisces: '双鱼座',
};

export const ZODIAC_DATE_RANGES: Record<ZodiacSign, { start: string; end: string }> = {
  aries: { start: '03-21', end: '04-19' },
  taurus: { start: '04-20', end: '05-20' },
  gemini: { start: '05-21', end: '06-20' },
  cancer: { start: '06-21', end: '07-22' },
  leo: { start: '07-23', end: '08-22' },
  virgo: { start: '08-23', end: '09-22' },
  libra: { start: '09-23', end: '10-22' },
  scorpio: { start: '10-23', end: '11-21' },
  sagittarius: { start: '11-22', end: '12-21' },
  capricorn: { start: '12-22', end: '01-19' },
  aquarius: { start: '01-20', end: '02-18' },
  pisces: { start: '02-19', end: '03-20' },
};

export interface ZodiacRequest {
  birthday?: string; // YYYY-MM-DD
  sign?: ZodiacSign;
  date?: string; // YYYY-MM-DD, 不传使用当天
}

export interface ZodiacResult {
  sign: ZodiacSign;
  signName: string;
  date: string;
  overall: number;   // 0-100
  love: number;
  career: number;
  health: number;
  luckyColor: string;
  luckyNumber: number;
  good: string;
  bad: string;
  level: string;     // e.g. 大吉 / 吉 / 平 / 凶
  summary: string;
}

// --- 塔罗 ---

export type TarotSpread = 'single' | 'three_card';
export type TarotDeck = 'major' | 'full'; // major=22张大阿卡纳, full=78张完整牌组

export interface TarotRequest {
  spread: TarotSpread;
  question?: string;
  selectedIndexes?: number[];
  deck?: TarotDeck;
}

export interface TarotCardResult {
  index: number;        // 0-21
  name: string;         // 中文牌名
  nameEn: string;       // 英文牌名
  isUpright: boolean;   // 正位 true，逆位 false
  keywords: string[];
  meaning: string;      // 解释
  position: string;     // 位置描述（single / past / present / future）
}

export interface TarotResult {
  spread: TarotSpread;
  deck: TarotDeck;
  deckSize: number;
  selectedIndexes: number[];
  cards: TarotCardResult[];
  summary: string;
}

// --- 周易 ---

export type YaoValue = 6 | 7 | 8 | 9; // 6=老阴变爻, 7=少阳, 8=少阴, 9=老阳变爻

export interface IchingRequest {
  question?: string;
  coinTosses?: number[][]; // 6x3, 每枚2或3
}

export interface IchingLine {
  position: number;  // 1-6, 从下往上
  value: YaoValue;
  isChanging: boolean; // 6或9时为true
  label: string;       // 老阴/少阳/少阴/老阳
}

export interface HexagramInfo {
  code: string;       // 六位二进制编码, e.g. "111111" = 乾
  number: number;     // 1-64
  name: string;       // 中文卦名
  symbol: string;     // 卦象符号, e.g. "☰☰"
  description: string;
}

export interface IchingResult {
  lines: IchingLine[];           // 从下往上
  originalHexagram: HexagramInfo;
  changedHexagram: HexagramInfo | null; // 无变爻时为null
  changingLines: number[];       // 变爻位置
  summary: string;
}

// --- AI 解读 ---

export interface AiInterpretResult {
  interpretation: string;
  source: 'ai';
}

export interface AiIchInterpretRequest {
  changedNumber: number | null;
  changingLines: number[];
  originalNumber: number;
  question: string;
}

export interface AiTarotCardRequest {
  index: number;
  isUpright: boolean;
  position: "future" | "past" | "present" | "single";
}

export interface AiTarotRequest {
  cards: AiTarotCardRequest[];
  deck: 'major';
  question: string;
  spread: TarotSpread;
}

// --- 健康检查 ---

export interface HealthResult {
  status: string;
  version: string;
  modules: FortuneModule[];
}
