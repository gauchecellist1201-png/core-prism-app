// ============================================================
// ctaAbTest.ts — Checkout 最終 CTA の 3 案 A/B/C テスト基盤
//
// オーナー指示 (2026-06-03 第 9 波 OO):
//   Stripe 直前の CTA を 3 案からランダム表示 + クリックを計測。
//   将来の本格 A/B 改善の土台。
//
// 動作:
//   1) 初回訪問時に variant をランダム選択 → localStorage に永続
//   2) 同ユーザーは同 variant を見続ける (実験の整合性)
//   3) インプレッション (表示) + クリックを localStorage + /api/track/cta-click に
//      ベストエフォート ビーコン (sendBeacon)
// ============================================================

const STORAGE_KEY = 'core_cta_ab_variant_v1';
const COUNTS_KEY = 'core_cta_ab_counts_v1';
const BEACON_PATH = '/api/track/cta-click';

export type CtaVariantId = 'A' | 'B' | 'C';

export type CtaVariant = {
  id: CtaVariantId;
  label: string;
  emoji?: string;
};

export const CTA_VARIANTS: CtaVariant[] = [
  { id: 'A', label: '7 日無料で始める',         emoji: '✨' },
  { id: 'B', label: '無料で 13 役員を雇う',     emoji: '👔' },
  { id: 'C', label: '今日から AI 役員を始動する', emoji: '🚀' },
];

type AbCounts = Record<CtaVariantId, { impressions: number; clicks: number; lastImpressionAt?: number; lastClickAt?: number }>;

function emptyCounts(): AbCounts {
  return {
    A: { impressions: 0, clicks: 0 },
    B: { impressions: 0, clicks: 0 },
    C: { impressions: 0, clicks: 0 },
  };
}

function loadCounts(): AbCounts {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') return { ...emptyCounts(), ...p };
    }
  } catch { /* */ }
  return emptyCounts();
}

function saveCounts(c: AbCounts) {
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)); } catch { /* */ }
}

/**
 * ユーザーごとに 1 つの variant を決定し、以降ずっと同じものを返す。
 * SSR / localStorage 不可な環境では常に 'A' を返す。
 */
export function pickVariant(): CtaVariant {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return CTA_VARIANTS[0];
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'A' || saved === 'B' || saved === 'C') {
      const v = CTA_VARIANTS.find(x => x.id === saved);
      if (v) return v;
    }
  } catch { /* */ }

  // 3 等分の決定的疑似乱数 (crypto.getRandomValues を使い Math.random を回避)
  let chosen: CtaVariantId = 'A';
  try {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    const slot = arr[0] % 3;
    chosen = (['A', 'B', 'C'] as const)[slot];
  } catch {
    chosen = 'A';
  }
  try { localStorage.setItem(STORAGE_KEY, chosen); } catch { /* */ }
  return CTA_VARIANTS.find(x => x.id === chosen) || CTA_VARIANTS[0];
}

function beacon(payload: { event: 'impression' | 'click'; variant: CtaVariantId; location: string }) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(BEACON_PATH, blob);
    } else {
      fetch(BEACON_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* */ });
    }
  } catch { /* */ }
}

/** 表示時に 1 回だけ呼ぶ。location は 'checkout-payment' 等。 */
export function trackImpression(variant: CtaVariantId, location: string) {
  const c = loadCounts();
  c[variant].impressions += 1;
  c[variant].lastImpressionAt = Date.now();
  saveCounts(c);
  beacon({ event: 'impression', variant, location });
}

export function trackClick(variant: CtaVariantId, location: string) {
  const c = loadCounts();
  c[variant].clicks += 1;
  c[variant].lastClickAt = Date.now();
  saveCounts(c);
  beacon({ event: 'click', variant, location });
}

/** master ダッシュ用 */
export function getLocalCounts(): AbCounts {
  return loadCounts();
}
