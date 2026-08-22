// ============================================================
// CORE SALES SCORE — 営業先評価 (100点満点)
//
// 方針: AI に「点数」を丸投げしない。
//   AI は 各項目の 点数案 + 根拠(evidence) を返すだけ。
//   根拠が空の項目は「未確認」として 0 点にし、confidence を下げる。
//   → 何も調べられなかった企業が、AI の想像だけで 90 点になる事故を防ぐ。
// ============================================================
import type { ScoreItem, ScoreKey, ScoreResult } from './types';

export const SCORE_DEFS: Array<{ key: ScoreKey; label: string; max: number; what: string }> = [
  { key: 'videoDemand', label: '動画需要', max: 20, what: 'SNS投稿頻度 / 動画投稿の有無 / 広告出稿 / YouTube・Instagram・TikTok' },
  { key: 'buyingSignal', label: '購買シグナル', max: 20, what: '動画・SNS・広告・マーケティングの求人 / 外注募集' },
  { key: 'companySize', label: '企業規模', max: 15, what: '売上 / 従業員 / 店舗数 / 事業規模' },
  { key: 'productFit', label: '商品との相性', max: 20, what: '映像で魅力が伝わるか / ストーリー化できるか / AI動画との相性' },
  { key: 'continuity', label: '継続性', max: 15, what: '月4本以上の制作需要がありそうか' },
  { key: 'oemPotential', label: 'OEM可能性', max: 10, what: '代理店 / 制作会社 / マーケティング会社か' },
];

export const SCORE_MAX = SCORE_DEFS.reduce((a, d) => a + d.max, 0); // = 100

/** AI から来た生の項目 (信用しない) */
export interface RawScoreItem {
  key?: string;
  value?: unknown;
  evidence?: unknown;
}

function toInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 根拠として認めるかどうか。「不明」「推測」だけの文字列は根拠ではない。 */
function isRealEvidence(s: string): boolean {
  const t = s.trim();
  if (t.length < 6) return false;
  if (/^(不明|未確認|なし|無し|不詳|情報なし|推測|わからない|—|-)$/i.test(t)) return false;
  return true;
}

/**
 * AI の項目案を検算して ScoreResult にする。
 * - 範囲外は clamp
 * - 根拠が無い項目は 0 点 + unknown
 * - 合計は必ず 0..100
 */
export function buildScore(raw: RawScoreItem[] | null | undefined): ScoreResult {
  const list = Array.isArray(raw) ? raw : [];
  const items: ScoreItem[] = SCORE_DEFS.map(def => {
    const hit = list.find(r => String(r?.key ?? '') === def.key);
    const evidence = String(hit?.evidence ?? '').trim();
    const ok = isRealEvidence(evidence);
    const proposed = Math.max(0, Math.min(def.max, toInt(hit?.value)));
    return {
      key: def.key,
      label: def.label,
      max: def.max,
      value: ok ? proposed : 0,
      evidence: ok ? evidence : '',
      unknown: !ok,
    };
  });
  const total = Math.max(0, Math.min(SCORE_MAX, items.reduce((a, i) => a + i.value, 0)));
  const known = items.filter(i => !i.unknown).length;
  return { total, items, confidence: items.length ? known / items.length : 0 };
}

/** 空のスコア (未分析) */
export function emptyScore(): ScoreResult {
  return {
    total: 0,
    items: SCORE_DEFS.map(d => ({
      key: d.key, label: d.label, max: d.max, value: 0, evidence: '', unknown: true,
    })),
    confidence: 0,
  };
}

/** 一覧の色分け */
export function scoreBand(total: number): { label: string; color: string } {
  if (total >= 80) return { label: '最優先', color: '#16C77A' };
  if (total >= 60) return { label: '優先', color: '#4DC3FF' };
  if (total >= 40) return { label: '通常', color: '#A0A6B2' };
  return { label: '後回し', color: '#6B7280' };
}

/**
 * 今日の営業順位。スコアだけで並べると
 *  「期限が来ている追客」が新規の高スコアに毎回抜かされて一生実行されないので、
 *  期限超過 > 期限当日 > 未接触の高スコア の順に効く重みを足す。
 */
export function priorityValue(args: {
  score: number;
  nextActionAt: string | null;
  touches: number;
  todayISO: string;
}): number {
  const { score, nextActionAt, touches, todayISO } = args;
  let v = score;
  if (nextActionAt) {
    if (nextActionAt < todayISO) v += 220;        // 期限超過 = 最優先
    else if (nextActionAt === todayISO) v += 160; // 今日やる
    else v -= 60;                                  // まだ先 = 下げる
  } else if (touches === 0) {
    v += 40;                                       // 一度も触っていない新規
  }
  return v;
}
