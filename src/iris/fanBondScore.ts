// ============================================================
// IRIS — Fan Bond Score
//
// 各ファンに 1-100 の「絆スコア」を計算する。
//
// 内訳 (満点 100):
//   ① lastInteraction の頻度 / 直近性 ........ 40 pt
//   ② tag boost
//        スーパーファン +30 / 長期 +20 /
//        個人友人 +25 / 新規 +5
//   ③ メモのポジティブ語 ..................... +10
//   ④ topics 数 ............................... +5
//   ⑤ relationSince 経過月 ................... +5
//   ⑥ 自分の返信 (myReply) 比率 ............... +10
//
// しきい値:
//   30 → 顔見知り
//   60 → 仲良し
//   90 → 親友
// ============================================================

import type { FanContact, FanTag } from './IrisFanEngagement';

export type FanBondLevel = 0 | 1 | 2 | 3;

export const BOND_LEVEL_META: Record<FanBondLevel, {
  label: string;
  emoji: string;
  color: string;
  min: number;
}> = {
  0: { label: '出会ったばかり', emoji: '🌱', color: '#A0AEC0', min: 0 },
  1: { label: '顔見知り',       emoji: '☕', color: '#F59E0B', min: 30 },
  2: { label: '仲良し',         emoji: '💛', color: '#EC4899', min: 60 },
  3: { label: '親友',           emoji: '💖', color: '#DC2626', min: 90 },
};

const TAG_BOOST: Record<FanTag, number> = {
  'スーパーファン': 30,
  '長期ファン':     20,
  '新規':            5,
  '個人的友人':     25,
};

const POSITIVE_WORDS = [
  '大好き', '推し', '神', '最高', '素敵', '尊敬',
  '応援', 'ありがとう', '感謝', '楽しい', '癒', '元気',
  '励まされ', '勇気', '感動', '泣いた', '感激',
  '好き', '愛', '幸せ', 'love', 'thanks',
];

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.floor((d2 - d1) / 86400000);
}

/** lastInteraction の頻度 / 直近性 (最大 40 pt) */
function interactionScore(fan: FanContact): number {
  const ints = fan.interactions;
  if (ints.length === 0) return 0;

  // 件数スコア (最大 24 pt) — 件数の log で逓減
  const countPt = Math.min(24, Math.round(Math.log2(ints.length + 1) * 8));

  // 直近性 (最大 16 pt) — 最終 interaction が 7 日以内: 16、30 日: 8、90 日: 0
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = ints[0]?.date || fan.createdAt.slice(0, 10);
  const days = Math.max(0, daysBetween(lastDate, today));
  const recencyPt = days <= 7 ? 16
                  : days <= 14 ? 12
                  : days <= 30 ? 8
                  : days <= 60 ? 4
                  : days <= 90 ? 2
                  : 0;
  return countPt + recencyPt;
}

/** タグブースト (最大 30 pt) */
function tagScore(fan: FanContact): number {
  return TAG_BOOST[fan.tag] ?? 0;
}

/** メモのポジティブ語 (最大 10 pt) — 2 語ごとに +5 */
function positivityScore(fan: FanContact): number {
  const text = (fan.notes + ' ' + fan.interactions.map(i => i.content).join(' ')).toLowerCase();
  let hits = 0;
  for (const w of POSITIVE_WORDS) {
    if (text.includes(w.toLowerCase())) hits++;
    if (hits >= 2) break;
  }
  return Math.min(10, hits * 5);
}

/** トピック数 (最大 5 pt) */
function topicScore(fan: FanContact): number {
  return Math.min(5, fan.topics.length * 2);
}

/** 関係期間 (最大 5 pt) */
function loyaltyScore(fan: FanContact): number {
  if (!fan.relationSince) return 0;
  const startStr = fan.relationSince.length === 7 ? fan.relationSince + '-01' : fan.relationSince;
  const months = Math.max(0, daysBetween(startStr, new Date().toISOString().slice(0, 10)) / 30);
  if (months >= 24) return 5;
  if (months >= 12) return 4;
  if (months >= 6)  return 3;
  if (months >= 3)  return 2;
  if (months >= 1)  return 1;
  return 0;
}

/** 自分が返信した比率 (最大 10 pt) */
function reciprocityScore(fan: FanContact): number {
  if (fan.interactions.length === 0) return 0;
  const replied = fan.interactions.filter(i => (i.myReply || '').trim().length > 0).length;
  const ratio = replied / fan.interactions.length;
  return Math.round(ratio * 10);
}

/** ── 公開 API ──────────────────────────── */

export interface FanBondBreakdown {
  total: number;       // 0-100
  level: FanBondLevel; // 0..3
  parts: {
    interaction: number;
    tag: number;
    positivity: number;
    topic: number;
    loyalty: number;
    reciprocity: number;
  };
}

export function calcFanBondScore(fan: FanContact): FanBondBreakdown {
  const interaction = interactionScore(fan);
  const tag         = tagScore(fan);
  const positivity  = positivityScore(fan);
  const topic       = topicScore(fan);
  const loyalty     = loyaltyScore(fan);
  const reciprocity = reciprocityScore(fan);
  const total = Math.min(100, interaction + tag + positivity + topic + loyalty + reciprocity);
  const level: FanBondLevel = total >= 90 ? 3 : total >= 60 ? 2 : total >= 30 ? 1 : 0;
  return {
    total,
    level,
    parts: { interaction, tag, positivity, topic, loyalty, reciprocity },
  };
}

/** 候補からそっと押し上げる: 連絡から日数が経って静かに下がる時間カーブ等を考慮 */
export function scoreToLevel(total: number): FanBondLevel {
  return total >= 90 ? 3 : total >= 60 ? 2 : total >= 30 ? 1 : 0;
}

/** 「次のレベルまで何 pt」を返す。Lv.3 なら null */
export function pointsToNextLevel(total: number): { needed: number; nextLabel: string } | null {
  if (total >= 90) return null;
  const next = total >= 60 ? 90 : total >= 30 ? 60 : 30;
  const nextLevel: FanBondLevel = total >= 60 ? 3 : total >= 30 ? 2 : 1;
  return { needed: Math.max(1, next - total), nextLabel: BOND_LEVEL_META[nextLevel].label };
}
