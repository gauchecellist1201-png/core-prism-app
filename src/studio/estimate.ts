// ============================================================
// CORE Studio — 見積ウィザードの純粋関数
// estimate(answers) => { plan, minPrice, maxPrice, note }
// UI から分離してテスト可能に。価格単位は「万円」。
// ============================================================
import { PRODUCTION_PLANS, DEV_TIERS } from './plans';

export type Purpose = 'lp' | 'corporate' | 'ec' | 'webapp' | 'saas';
export type Scale = 'small' | 'medium' | 'large';
export type Feature = 'booking' | 'payment' | 'auth' | 'ai' | 'multilingual';
export type Timeline = 'asap' | 'normal' | 'flexible';
export type Budget = 'u10' | 'u30' | 'u100' | 'u500' | 'over500' | 'unknown';

export type EstimateAnswers = {
  purpose: Purpose;
  scale: Scale;
  cms: boolean;
  features: Feature[];
  timeline: Timeline;
  budget: Budget;
};

export type EstimateResult = {
  plan: string;      // 表示名 (例: 'Core' / 'MVP')
  planId: string;    // plans.ts / DEV_TIERS の id
  kind: 'production' | 'dev';
  minPrice: number;  // 万円
  maxPrice: number;  // 万円
  note: string;
};

// 目的ごとの基礎レンジ (万円)
const BASE: Record<Purpose, [number, number]> = {
  lp: [5, 15],
  corporate: [10, 30],
  ec: [30, 80],
  webapp: [50, 150],
  saas: [150, 500],
};

// 規模係数
const SCALE_MULT: Record<Scale, number> = { small: 1, medium: 1.5, large: 2.5 };

// 機能の追加費 (万円) — サイト系 / 開発系で重みが違う
const FEATURE_ADD: Record<Feature, [number, number]> = {
  booking: [10, 20],
  payment: [10, 25],
  auth: [15, 40],
  ai: [15, 50],
  multilingual: [8, 20],
};

const BUDGET_MAX: Record<Budget, number> = {
  u10: 10, u30: 30, u100: 100, u500: 500, over500: Infinity, unknown: Infinity,
};

/** 5捨5入で「万円」を丸める (最小5万円) */
const round = (v: number) => Math.max(5, Math.round(v / 5) * 5);

export function estimate(answers: EstimateAnswers): EstimateResult {
  const isDev = answers.purpose === 'webapp' || answers.purpose === 'saas';
  const [baseMin, baseMax] = BASE[answers.purpose];
  const mult = SCALE_MULT[answers.scale];

  let min = baseMin * mult;
  let max = baseMax * mult;

  // CMS (サイト系のみ加算。開発系は管理画面としてTierに内包)
  if (answers.cms && !isDev) { min += 5; max += 10; }

  // 機能追加
  for (const f of answers.features) {
    const [aMin, aMax] = FEATURE_ADD[f];
    min += isDev ? aMin * 1.5 : aMin;
    max += isDev ? aMax * 1.5 : aMax;
  }

  // 特急は +20%
  if (answers.timeline === 'asap') { min *= 1.2; max *= 1.2; }

  min = round(min);
  max = round(Math.max(max, min));

  // プラン判定 — レンジの中央値で最も現実的な帯に割り当てる
  const mid = (min + max) / 2;
  let plan: string; let planId: string;
  if (isDev) {
    const tier =
      DEV_TIERS.find(t => mid <= t.maxPrice) ?? DEV_TIERS[DEV_TIERS.length - 1];
    plan = tier.name; planId = tier.id;
  } else {
    const p =
      mid <= 10 ? PRODUCTION_PLANS[0] :
      mid <= 32 ? PRODUCTION_PLANS[1] :
      mid <= 105 ? PRODUCTION_PLANS[2] :
      PRODUCTION_PLANS[3];
    plan = p.name; planId = p.id;
  }

  // ノート (予算との整合)
  const budgetMax = BUDGET_MAX[answers.budget];
  let note: string;
  if (budgetMax < min) {
    note = `ご予算の範囲では、機能を絞った段階的な構築 (第一弾を${budgetMax}万円以内で公開し、順次拡張) をご提案できます。まずはご相談ください。`;
  } else if (answers.timeline === 'asap') {
    note = '特急対応 (+20%) を含む概算です。要件を絞ることで、通常価格での短納期に対応できる場合があります。';
  } else {
    note = 'ヒアリングの上、この範囲内で正式なお見積りを確定します。ご契約後の追加費用は発生しません。';
  }

  return { plan, planId, kind: isDev ? 'dev' : 'production', minPrice: min, maxPrice: max, note };
}
