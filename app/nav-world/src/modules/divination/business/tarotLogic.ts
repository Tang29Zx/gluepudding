// ============================================================
// 塔罗桌 — 业务纯函数
// 提取自：resources/feature_implementation/src/modules/divination/components/TarotPanel.tsx
// 用途：3D 塔罗交互中的选牌校验、卡牌标签、牌组计算
// ============================================================

import type { TarotDeck, TarotSpread } from '../types';

export const MAJOR_LABELS = [
  '愚者', '魔术师', '女祭司', '女皇', '皇帝', '教皇', '恋人', '战车',
  '力量', '隐士', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔',
  '高塔', '星星', '月亮', '太阳', '审判', '世界',
];

const MINOR_SUITS: Record<string, string> = {
  wands: '权杖', cups: '圣杯', swords: '宝剑', pentacles: '星币',
};

const SUIT_ORDER = ['wands', 'cups', 'swords', 'pentacles'];

/** 获取 0-index 卡牌位置的中文标签 */
export function getCardLabel(index: number, deck: TarotDeck): string {
  if (deck === 'major' || index < 22) {
    return MAJOR_LABELS[index] || `${index + 1}`;
  }
  const minorIndex = index - 22;
  const suit = SUIT_ORDER[Math.floor(minorIndex / 14)];
  const rank = minorIndex % 14;
  const suitCN = MINOR_SUITS[suit] || '';
  if (rank === 0) return `${suitCN}A`;
  if (rank < 10) return `${suitCN}${rank + 1}`;
  const court = ['侍', '骑', '后', '王'];
  return `${suitCN}${court[rank - 10]}`;
}

/** 获取指定牌组的卡牌总数 */
export function getDeckSize(deck: TarotDeck): number {
  return deck === 'full' ? 78 : 22;
}

/** 获取指定牌阵需要选牌的数量 */
export function getMaxCards(spread: TarotSpread): number {
  return spread === 'single' ? 1 : 3;
}

/** 判断某张牌是否可以被选中 */
export function canSelectCard(
  cardIndex: number,
  selectedIndexes: number[],
  maxCards: number
): boolean {
  if (selectedIndexes.includes(cardIndex)) return false;
  if (selectedIndexes.length >= maxCards) return false;
  return true;
}

/** 判断当前选择是否满足提交条件 */
export function canSubmitSelection(
  selectedIndexes: number[],
  maxCards: number
): boolean {
  return selectedIndexes.length === maxCards;
}

/** 判断单个卡牌索引是否已被选中 */
export function isCardSelected(
  cardIndex: number,
  selectedIndexes: number[]
): boolean {
  return selectedIndexes.includes(cardIndex);
}

/** 添加卡牌到选中列表（不可变操作） */
export function selectCard(
  cardIndex: number,
  selectedIndexes: number[],
  maxCards: number
): number[] {
  if (!canSelectCard(cardIndex, selectedIndexes, maxCards)) {
    return selectedIndexes;
  }
  return [...selectedIndexes, cardIndex];
}

/** 从选中列表移除卡牌（不可变操作） */
export function deselectCard(
  cardIndex: number,
  selectedIndexes: number[]
): number[] {
  return selectedIndexes.filter((i) => i !== cardIndex);
}
