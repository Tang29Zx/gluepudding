// ============================================================
// 周易桌 — 业务纯函数
// 提取自：resources/feature_implementation/src/modules/divination/components/IchingPanel.tsx
// 用途：3D 周易交互中的爻线计算、卦象查表、铜钱法模拟
// ============================================================

import type { YaoValue, IchingLine, IchingResult, HexagramInfo } from '../types';
import iching64 from '../data/iching_64.json';

const HEXAGRAM_MAP: Map<string, Omit<HexagramInfo, 'code'> & { code: string }> = new Map();

// 加载 64 卦数据到内存 Map
(iching64 as Array<{ code: string; number: number; name: string; symbol: string; description: string }>).forEach((h) => {
  HEXAGRAM_MAP.set(h.code, {
    code: h.code,
    number: h.number,
    name: h.name,
    symbol: h.symbol,
    description: h.description,
  });
});

/** 判断爻值是否为阳爻 */
export function isYang(value: YaoValue): boolean {
  return value === 7 || value === 9;
}

/** 判断爻值是否为阴爻 */
export function isYin(value: YaoValue): boolean {
  return value === 6 || value === 8;
}

/** 判断爻是否为变爻 */
export function isChangingLine(value: YaoValue): boolean {
  return value === 6 || value === 9;
}

/** 获取爻的中文标签 */
export function getYaoLabel(value: YaoValue): string {
  switch (value) {
    case 6: return '老阴';
    case 7: return '少阳';
    case 8: return '少阴';
    case 9: return '老阳';
  }
}

/** 单次铜钱投掷（3 枚，每枚 2 或 3，求和得 6/7/8/9） */
export function tossCoins(): YaoValue {
  const coins = [Math.random() < 0.5 ? 2 : 3, Math.random() < 0.5 ? 2 : 3, Math.random() < 0.5 ? 2 : 3];
  return (coins.reduce((a: number, b: number) => a + b, 0)) as YaoValue;
}

/** 六次铜钱投掷，返回 6 个爻值（从下往上，position 1-6） */
export function castHexagram(): YaoValue[] {
  return [tossCoins(), tossCoins(), tossCoins(), tossCoins(), tossCoins(), tossCoins()];
}

/** 将 6 个爻值转为 IchingLine[]（从下往上） */
export function linesFromValues(values: YaoValue[]): IchingLine[] {
  return values.map((value, i) => ({
    position: i + 1,
    value,
    isChanging: isChangingLine(value),
    label: getYaoLabel(value),
  }));
}

/** 根据 6 个爻值查找本卦 */
export function lookUpHexagram(values: YaoValue[]): HexagramInfo {
  // 阴阳 -> 二进制编码：阳(7/9)=1，阴(6/8)=0，从上往下
  const code = values
    .slice()
    .reverse()
    .map((v) => (isYang(v) ? '1' : '0'))
    .join('');

  const found = HEXAGRAM_MAP.get(code);
  if (found) return found;

  // fallback: 查无此卦时返回空卦
  return {
    code,
    number: 0,
    name: '未知卦',
    symbol: '',
    description: '',
  };
}

/** 计算变卦：将变爻翻转后重新查卦 */
export function lookUpChangedHexagram(values: YaoValue[]): HexagramInfo | null {
  const changingPositions = values
    .map((v, i) => (isChangingLine(v) ? i : -1))
    .filter((i) => i >= 0);

  if (changingPositions.length === 0) return null;

  const changedValues = values.map((v, i) => {
    if (!isChangingLine(v)) return v;
    // 老阳(9) → 少阴(8), 老阴(6) → 少阳(7)
    return v === 9 ? 8 : 7;
  }) as YaoValue[];

  return lookUpHexagram(changedValues);
}

/** 前端模拟完整起卦流程（纯函数，不调 API） */
export function simulateIchingCast(): IchingResult {
  const values = castHexagram();
  const lines = linesFromValues(values);
  const originalHexagram = lookUpHexagram(values);
  const changedHexagram = lookUpChangedHexagram(values);
  const changingLines = lines.filter((l) => l.isChanging).map((l) => l.position);

  const summary = changedHexagram
    ? `本卦为「${originalHexagram.name}」：${originalHexagram.description}。变爻：第${changingLines.join('、')}爻。变卦为「${changedHexagram.name}」：${changedHexagram.description}。综合来看，变化趋势预示着新的发展和转机。`
    : `本卦为「${originalHexagram.name}」：${originalHexagram.description}。卦象稳定，近期不会有太大变化。`;

  return { lines, originalHexagram, changedHexagram, changingLines, summary };
}
