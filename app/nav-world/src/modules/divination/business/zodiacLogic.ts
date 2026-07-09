// ============================================================
// 星座台 — 业务纯函数
// 提取自：resources/feature_implementation/src/modules/divination/components/ZodiacPanel.tsx
// 用途：3D 星座交互中的日期-星座映射、星座列表
// ============================================================

import type { ZodiacSign } from '../types';
import { ZODIAC_DATE_RANGES, ZODIAC_SIGN_NAMES } from '../types';

export const ZODIAC_SIGNS: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

/** 根据出生日期（YYYY-MM-DD）推断星座 */
export function getSignFromBirthday(birthday: string): ZodiacSign | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;

  const monthDay = birthday.slice(5); // MM-DD

  for (const sign of ZODIAC_SIGNS) {
    const { start, end } = ZODIAC_DATE_RANGES[sign];

    // 跨年星座（摩羯座 12-22 ~ 01-19）
    if (start > end) {
      if (monthDay >= start || monthDay <= end) return sign;
    } else {
      if (monthDay >= start && monthDay <= end) return sign;
    }
  }

  return null;
}

/** 获取星座的中文名称 */
export function getSignName(sign: ZodiacSign): string {
  return ZODIAC_SIGN_NAMES[sign] || sign;
}

/** 获取星座的日期范围描述 */
export function getSignDateRange(sign: ZodiacSign): string {
  const range = ZODIAC_DATE_RANGES[sign];
  return `${range.start} ~ ${range.end}`;
}
