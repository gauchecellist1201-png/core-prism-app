// ============================================================
// Billing — プラン定義 + 現在のプラン管理 + Stripe URL フック
// ============================================================
import { useCallback, useEffect, useState } from 'react';

// v1 = 旧プラン (現状ユーザー) / v2 = 新プラン (BtoB/BtoC 6 階層、2026-06-03 承認)
export type PlanId =
  // v1 (既存・後方互換)
  | 'free' | 'lite' | 'standard' | 'pro' | 'studio'
  // v2 BtoC (個人 / スモール)
  | 'v2-btoC-light' | 'v2-btoC-standard' | 'v2-btoC-pro'
  // v2 BtoB (法人)
  | 'v2-btoB-entry' | 'v2-btoB-standard' | 'v2-btoB-pro'
  // v2 Enterprise (年契約・営業ハンドル)
  | 'v2-enterprise';
export type Brand = 'iris' | 'prism';
export type PlanFamily = 'v1' | 'btoC' | 'btoB' | 'enterprise';

// ─── プラン別 機能制限 ───
export type FeatureKey =
  | 'ai-chat'           // AI 戦略相談・チャット
  | 'screenshot-ai'     // スクショから AI で構造化
  | 'caption-ai'        // 投稿構成・キャプション生成
  | 'negotiation-ai'    // 交渉文 AI
  | 'triage-ai'         // 案件精査 AI
  | 'beauty-advice'     // 美容相談
  | 'instagram-analyze' // Instagram 解析 (Vision)
  | 'story-arc'         // 30日プラン
  | 'community'         // コミュニティ参加
  | 'team-members'      // 連携アカウント
  | 'brand-match'       // ブランドマッチ (Pro+)
  | 'script-studio'     // 企画・台本スタジオ (運用代行モード) — 最上位プラン限定
  | 'api-access'        // API キー (Studio)
  | 'white-label';      // ホワイトラベル (Studio)

export type FeatureLimit = number | 'unlimited' | 'unavailable';

/** プラン × 機能 = 月間使用上限 */
export const PLAN_LIMITS: Record<PlanId, Partial<Record<FeatureKey, FeatureLimit>>> = {
  free: {
    'ai-chat': 30,
    'screenshot-ai': 5,
    'caption-ai': 5,
    'negotiation-ai': 3,
    'triage-ai': 5,
    'beauty-advice': 10,
    'instagram-analyze': 1,
    'story-arc': 1,
    'community': 'unlimited',
    'team-members': 1,
    'brand-match': 'unavailable',
    'api-access': 'unavailable',
    'white-label': 'unavailable',
  },
  lite: {
    'ai-chat': 30,
    'screenshot-ai': 10,
    'caption-ai': 30,
    'negotiation-ai': 20,
    'triage-ai': 30,
    'beauty-advice': 50,
    'instagram-analyze': 3,
    'story-arc': 1,
    'community': 'unlimited',
    'team-members': 1,
    'brand-match': 'unavailable',
    'api-access': 'unavailable',
    'white-label': 'unavailable',
  },
  standard: {
    'ai-chat': 'unlimited',
    'screenshot-ai': 'unlimited',
    'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited',
    'triage-ai': 'unlimited',
    'beauty-advice': 'unlimited',
    'instagram-analyze': 10,
    'story-arc': 5,
    'community': 'unlimited',
    'team-members': 1,
    'brand-match': 'unavailable',
    'api-access': 'unavailable',
    'white-label': 'unavailable',
  },
  pro: {
    'ai-chat': 'unlimited',
    'screenshot-ai': 'unlimited',
    'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited',
    'triage-ai': 'unlimited',
    'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited',
    'story-arc': 'unlimited',
    'community': 'unlimited',
    'team-members': 5,
    'brand-match': 'unlimited',
    'script-studio': 'unlimited',
    'api-access': 'unavailable',
    'white-label': 'unavailable',
  },
  studio: {
    'ai-chat': 'unlimited',
    'screenshot-ai': 'unlimited',
    'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited',
    'triage-ai': 'unlimited',
    'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited',
    'story-arc': 'unlimited',
    'community': 'unlimited',
    'team-members': 'unlimited',
    'brand-match': 'unlimited',
    'script-studio': 'unlimited',
    'api-access': 'unlimited',
    'white-label': 'unlimited',
  },
  // ── v2 BtoC (個人 / スモール) ─────────────────────
  'v2-btoC-light': {
    'ai-chat': 300, 'screenshot-ai': 10, 'caption-ai': 10, 'negotiation-ai': 5,
    'triage-ai': 10, 'beauty-advice': 30, 'instagram-analyze': 2,
    'story-arc': 1, 'community': 'unlimited', 'team-members': 1,
    'brand-match': 'unavailable', 'api-access': 'unavailable', 'white-label': 'unavailable',
  },
  'v2-btoC-standard': {
    'ai-chat': 1500, 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 20, 'story-arc': 5, 'community': 'unlimited', 'team-members': 1,
    'brand-match': 'unavailable', 'api-access': 'unavailable', 'white-label': 'unavailable',
  },
  'v2-btoC-pro': {
    'ai-chat': 'unlimited', 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited', 'story-arc': 'unlimited', 'community': 'unlimited',
    'team-members': 1, 'brand-match': 'unlimited', 'script-studio': 'unlimited', 'api-access': 'unavailable', 'white-label': 'unavailable',
  },
  // ── v2 BtoB (法人) ────────────────────────────────
  'v2-btoB-entry': {
    'ai-chat': 3000, 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 40, 'story-arc': 'unlimited', 'community': 'unlimited',
    'team-members': 5, 'brand-match': 'unlimited', 'api-access': 'unavailable', 'white-label': 'unavailable',
  },
  'v2-btoB-standard': {
    'ai-chat': 10000, 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited', 'story-arc': 'unlimited', 'community': 'unlimited',
    'team-members': 15, 'brand-match': 'unlimited', 'api-access': 'unavailable', 'white-label': 'unavailable',
  },
  'v2-btoB-pro': {
    'ai-chat': 'unlimited', 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited', 'story-arc': 'unlimited', 'community': 'unlimited',
    'team-members': 50, 'brand-match': 'unlimited', 'script-studio': 'unlimited', 'api-access': 'unlimited', 'white-label': 'unavailable',
  },
  // ── v2 Enterprise (年契約) ────────────────────────
  'v2-enterprise': {
    'ai-chat': 'unlimited', 'screenshot-ai': 'unlimited', 'caption-ai': 'unlimited',
    'negotiation-ai': 'unlimited', 'triage-ai': 'unlimited', 'beauty-advice': 'unlimited',
    'instagram-analyze': 'unlimited', 'story-arc': 'unlimited', 'community': 'unlimited',
    'team-members': 'unlimited', 'brand-match': 'unlimited', 'script-studio': 'unlimited', 'api-access': 'unlimited', 'white-label': 'unlimited',
  },
};

export const FEATURE_META: Record<FeatureKey, { label: string; emoji: string }> = {
  'ai-chat':           { label: 'AI 相談・チャット',  emoji: '💬' },
  'screenshot-ai':     { label: 'スクショ AI 入力',    emoji: '📸' },
  'caption-ai':        { label: '投稿構成・キャプション', emoji: '✍' },
  'negotiation-ai':    { label: '交渉文 AI',          emoji: '🤝' },
  'triage-ai':         { label: '案件精査 AI',        emoji: '🔍' },
  'beauty-advice':     { label: '美容相談',           emoji: '💆' },
  'instagram-analyze': { label: 'Instagram 解析',     emoji: '📊' },
  'story-arc':         { label: '30 日プラン',        emoji: '🌙' },
  'community':         { label: 'コミュニティ',       emoji: '🌹' },
  'team-members':      { label: 'チームメンバー',     emoji: '🌷' },
  'brand-match':       { label: 'ブランドマッチ',     emoji: '✨' },
  'script-studio':     { label: '企画・台本スタジオ', emoji: '🎬' },
  'api-access':        { label: 'API アクセス',       emoji: '🔌' },
  'white-label':       { label: 'ホワイトラベル',     emoji: '🎨' },
};

/** 現在のプランで feature が使えるか + 残り回数 */
export function checkFeature(plan: PlanId, feature: FeatureKey): {
  allowed: boolean;
  limit: FeatureLimit;
  unavailable: boolean;
  upgradeTo?: PlanId;
} {
  const limit = PLAN_LIMITS[plan]?.[feature];
  if (limit === 'unavailable' || limit === undefined) {
    // どのプランで使えるか
    const upgradeTo = (['lite', 'standard', 'pro', 'studio'] as PlanId[])
      .find(p => {
        const l = PLAN_LIMITS[p]?.[feature];
        return l !== undefined && l !== 'unavailable';
      });
    return { allowed: false, limit: 'unavailable', unavailable: true, upgradeTo };
  }
  return { allowed: true, limit, unavailable: false };
}

// 使用量カウント (localStorage、月単位リセット)
const USAGE_KEY = 'core_feature_usage_v1';
interface UsageData { month: string; counts: Record<string, number>; }

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function getUsageCount(feature: FeatureKey): number {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const data: UsageData = raw ? JSON.parse(raw) : { month: currentMonth(), counts: {} };
    if (data.month !== currentMonth()) return 0;
    return data.counts[feature] || 0;
  } catch { return 0; }
}

export function incrementUsage(feature: FeatureKey) {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    let data: UsageData = raw ? JSON.parse(raw) : { month: currentMonth(), counts: {} };
    if (data.month !== currentMonth()) data = { month: currentMonth(), counts: {} };
    data.counts[feature] = (data.counts[feature] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  } catch { /* */ }
}

export type BillingCycle = 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  brand: Brand | 'both';
  name: string;
  priceJpy: number;
  /** 年額 (= 月額 × 10 = 2 ヶ月分お得) */
  priceJpy_yearly?: number;
  badge?: string;
  tagline: string;
  features: string[];
  /** 正式リリース時に Stripe Checkout URL を入れる (env 経由) — 月額 */
  stripeUrlEnvKey?: string;
  /** 年額 URL の env キー */
  stripeUrlEnvKey_yearly?: string;
}

export const IRIS_PLANS: Plan[] = [
  {
    id: 'free', brand: 'iris',
    name: '7 日間 無料トライアル', priceJpy: 0,
    tagline: 'まずは試す',
    features: ['全機能 7 日間 試せる', 'カード登録不要', '自動課金なし'],
  },
  {
    id: 'lite', brand: 'iris',
    name: 'Lite', priceJpy: 2980, priceJpy_yearly: 29800,
    tagline: '入門・副業クリエイター',
    features: [
      'AI 戦略相談 30 回/月',
      '案件管理 無制限',
      'スクショ AI 入力 月 10 回',
      '投稿構成・キャプション 月 30 回',
      '美容相談 月 50 回',
      '分析履歴 90 日',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_IRIS_LITE_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_IRIS_LITE_YEARLY_URL',
  },
  {
    id: 'standard', brand: 'iris',
    name: 'Standard', priceJpy: 6980, priceJpy_yearly: 69800,
    badge: '人気 No.1',
    tagline: '本気のクリエイター',
    features: [
      'AI 戦略相談 無制限',
      'スクショ AI 入力 無制限',
      '交渉文 AI 無制限',
      '案件精査 AI 無制限',
      '美容相談 無制限',
      '30 日プラン / 戦略アーク 月 5 回',
      'Instagram 解析 月 10 回',
      '分析履歴 365 日',
      'コミュニティ参加可',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_IRIS_STANDARD_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_IRIS_STANDARD_YEARLY_URL',
  },
  {
    id: 'pro', brand: 'iris',
    name: 'Pro', priceJpy: 12800, priceJpy_yearly: 128000,
    tagline: 'チーム / マネージャー',
    features: [
      'Standard 全機能',
      '連携アカウント 5',
      'ブランドマッチ (Prism 企業リスト連動)',
      '投稿カレンダー・自動 30 日プラン',
      '専任 CS / 優先サポート',
      'カスタムテンプレート (チーム共有)',
      'データ無制限',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_IRIS_PRO_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_IRIS_PRO_YEARLY_URL',
  },
  // Iris「Studio」は 2026-06-11 に廃止（3階層 Lite/Standard/Pro に統一）。
];

export const PRISM_PLANS: Plan[] = [
  {
    id: 'free', brand: 'prism',
    name: '7 日間 無料トライアル', priceJpy: 0,
    tagline: 'まずは試す',
    features: ['全機能 7 日間 試せる', 'カード登録不要', '自動課金なし'],
  },
  {
    id: 'lite', brand: 'prism',
    name: 'Starter', priceJpy: 4800, priceJpy_yearly: 48000,
    tagline: '個人・スタートアップ',
    features: [
      '基本 AI 機能',
      '1 人格 / 1 ユーザー',
      'ナレッジ 100 件まで',
      'コミュニティサポート',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STARTER_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_STARTER_YEARLY_URL',
  },
  {
    id: 'standard', brand: 'prism',
    name: 'Standard', priceJpy: 9800, priceJpy_yearly: 98000,
    badge: '人気 No.1',
    tagline: 'チームで本格活用',
    features: [
      '全 AI 機能 (商談 AI 含む)',
      '無制限人格 / 無制限ユーザー',
      'ナレッジ 無制限',
      'OpenAI TTS 音声秘書',
      'メール / Chat サポート',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STANDARD_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_STANDARD_YEARLY_URL',
  },
  {
    id: 'pro', brand: 'prism',
    name: 'Exclusive', priceJpy: 29800, priceJpy_yearly: 298000,
    tagline: 'プロフェッショナル / 経営者',
    features: [
      'Standard 全機能',
      '専任カスタマーサクセス',
      '優先サポート (1 営業日)',
      'カスタム連携 (Salesforce 等)',
      '社内研修 / 導入伴走',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_EXCLUSIVE_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_EXCLUSIVE_YEARLY_URL',
  },
  {
    id: 'studio', brand: 'prism',
    name: 'Studio', priceJpy: 98000, priceJpy_yearly: 980000,
    tagline: '事業会社・エンタープライズ',
    features: [
      'Exclusive 全機能',
      '専属導入チーム',
      'SLA 99.9% / 24h サポート',
      'API キー専有 / ホワイトラベル',
      'カスタム AI モデル調整',
      '監査ログ / SSO / セキュリティレビュー対応',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STUDIO_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_STUDIO_YEARLY_URL',
  },
];

// ============================================================
// v2 プラン定義 (2026-06-03 オーナー承認)
// 既存 v1 と併存。Phase 1 で `usePlansV2()` フラグを立てると新規 sign up が v2 へ
// ============================================================
export const PLAN_V2_FLAG_KEY = 'core_plan_v2_enabled';
/**
 * v2 プラン (BtoB/BtoC 6 階層) を使うかどうかの判定
 * 優先度:
 *   ① ローカル override (localStorage) — オーナーが個別に切替できる
 *   ② Vercel 環境変数 VITE_PLAN_V2_ENABLED = 'true' — 全ユーザー一斉切替
 *   ③ デフォルト false (v1 を使う)
 */
export function isPlanV2Enabled(): boolean {
  if (typeof window === 'undefined') return false;
  const local = localStorage.getItem(PLAN_V2_FLAG_KEY);
  if (local === 'true') return true;
  if (local === 'false') return false;
  // env でも切替可能 (Vercel デプロイ反映で全ユーザー一斉)
  const envFlag = (import.meta as { env?: { VITE_PLAN_V2_ENABLED?: string } })?.env?.VITE_PLAN_V2_ENABLED;
  return envFlag === 'true';
}
export function setPlanV2Enabled(on: boolean): void {
  localStorage.setItem(PLAN_V2_FLAG_KEY, on ? 'true' : 'false');
}

const _v2BtoCPrism: Plan[] = [
  {
    id: 'v2-btoC-light', brand: 'prism',
    name: 'Starter', priceJpy: 4800, priceJpy_yearly: 48000,
    tagline: '個人・一人社長', badge: 'BtoC',
    features: ['基本 AI', '1 人格', 'ナレッジ 100 件', '役員日報'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STARTER_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_STARTER_YEARLY_URL',
  },
  {
    id: 'v2-btoC-standard', brand: 'prism',
    name: 'Standard', priceJpy: 9800, priceJpy_yearly: 98000,
    badge: '人気 No.1', tagline: '本格活用・小規模法人',
    features: ['全 AI（商談 AI 含む）', '人格 無制限', '音声秘書', '最強の RAG ＋ 司令塔ループ'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STANDARD_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_STANDARD_YEARLY_URL',
  },
  {
    id: 'v2-btoC-pro', brand: 'prism',
    name: 'Exclusive', priceJpy: 29800, priceJpy_yearly: 298000,
    tagline: '法人',
    features: ['専任カスタマーサクセス', '契約 / 決算 AI', '導入伴走', '請求書払い'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_EXCLUSIVE_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_EXCLUSIVE_YEARLY_URL',
  },
];

const _v2BtoBPrism: Plan[] = [
  {
    id: 'v2-btoB-entry', brand: 'prism',
    name: 'エントリー', priceJpy: 20000, priceJpy_yearly: 200000,
    tagline: '法人 試験導入', badge: 'BtoB',
    features: ['AI 相談 月 3,000 回', 'チーム 5 名まで', '請求書払い対応 (口座振込)', '導入サポート'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_V2_BTOB_ENTRY_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_V2_BTOB_ENTRY_YEARLY_URL',
  },
  {
    id: 'v2-btoB-standard', brand: 'prism',
    name: 'スタンダード', priceJpy: 30000, priceJpy_yearly: 300000,
    badge: '法人 推奨', tagline: '中小企業 / 高収益フリーランス',
    features: ['AI 相談 月 10,000 回', 'フル機能', 'チーム 15 名まで', '請求書払い OK', 'コンサル代月¥200万を1/7に'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_V2_BTOB_STANDARD_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_V2_BTOB_STANDARD_YEARLY_URL',
  },
  {
    id: 'v2-btoB-pro', brand: 'prism',
    name: 'プロ (全機能)', priceJpy: 50000, priceJpy_yearly: 500000,
    tagline: '法人 上位 / 強い ROI',
    features: ['AI 全機能 無制限', 'チーム 50 名まで', '専任 CS', 'API キー専有', 'カスタム連携'],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_V2_BTOB_PRO_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_PRISM_V2_BTOB_PRO_YEARLY_URL',
  },
];

const _v2EnterprisePrism: Plan[] = [
  {
    id: 'v2-enterprise', brand: 'prism',
    name: 'エンタープライズ', priceJpy: 0, priceJpy_yearly: 2000000,
    tagline: '年契約 ¥200〜¥400 万 / 営業相談',
    badge: '要相談',
    features: [
      '全機能 + カスタム開発',
      '専属導入チーム + 月次定例',
      'SLA 99.9% / 24h サポート',
      'API キー専有 + ホワイトラベル',
      'カスタム AI モデル調整',
      'SSO / 監査ログ / セキュリティレビュー対応',
      '請求書払い (口座振込・年一括 or 半期)',
    ],
    // Enterprise は Stripe Checkout ではなく営業ハンドル
    stripeUrlEnvKey: undefined,
    stripeUrlEnvKey_yearly: undefined,
  },
];

// v2 全プラン (PRISM 用) — Iris は当面 PRISM の v2 を流用
export const PRISM_PLANS_V2: Plan[] = [
  ..._v2BtoCPrism,
  ..._v2BtoBPrism,
  ..._v2EnterprisePrism,
];

// Iris は当面 v1 のまま (将来 v2 拡張) — 切替は isPlanV2Enabled() で
export const IRIS_PLANS_V2: Plan[] = IRIS_PLANS;

export function getPlans(brand: Brand): Plan[] {
  if (isPlanV2Enabled()) {
    return brand === 'iris' ? IRIS_PLANS_V2 : PRISM_PLANS_V2;
  }
  return brand === 'iris' ? IRIS_PLANS : PRISM_PLANS;
}

export function findPlan(brand: Brand, id: PlanId): Plan | undefined {
  return getPlans(brand).find(p => p.id === id);
}

/** 環境変数から Stripe URL を取得 (本番リリース時に値を入れる) */
export function getStripeCheckoutUrl(plan: Plan, cycle: BillingCycle = 'monthly'): string | null {
  const key = cycle === 'yearly' ? plan.stripeUrlEnvKey_yearly : plan.stripeUrlEnvKey;
  if (!key) return null;
  const url = (import.meta.env as Record<string, string | undefined>)[key];
  return url || null;
}

/** プランの表示価格 (cycle に応じて月額/年額) */
export function getPlanPrice(plan: Plan, cycle: BillingCycle = 'monthly'): number {
  if (cycle === 'yearly' && plan.priceJpy_yearly !== undefined) return plan.priceJpy_yearly;
  return plan.priceJpy;
}

// ─── 紹介プログラム — 実装は src/lib/referral.ts へ分離 ───
// 後方互換のため re-export (旧 import パスを壊さない)
export {
  getReferralData,
  saveReferralData,
  getReferralUrl,
  captureReferralFromUrl,
  redeemPendingReferral,
  getPendingReferral,
  REFERRAL_BONUS_DAYS,
} from './referral';
export type { ReferralData } from './referral';
import { redeemPendingReferral as _redeemPendingReferral } from './referral';

// ============================================================
//  アクセスゲート
// ============================================================

/**
 * 旧「マスターモード」(GAUCHE2026) の判定。
 * Phase D で Owner ロールに置換。後方互換のため localStorage キーがあれば true。
 * Supabase 接続後は `markOwnerLocal()` が Owner ログイン時に同じキーを書き込み、
 * このフラグが「現端末は Owner」を意味するようになる。
 */
export function isMasterAuth(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('core_master_key_v1') === 'GAUCHE2026';
  } catch {
    return false;
  }
}

/** エイリアス: Phase D では「Owner ロール」と等価 */
export function isOwnerLocal(): boolean {
  return isMasterAuth();
}

/** Supabase で owner と判定された端末に Owner フラグを刻む */
export function markOwnerLocal() {
  try { localStorage.setItem('core_master_key_v1', 'GAUCHE2026'); } catch { /* */ }
}

/** Owner ロールから降りる (admin/member へのロール変更で呼ぶ) */
export function clearOwnerLocal() {
  try { localStorage.removeItem('core_master_key_v1'); } catch { /* */ }
}

/** トライアル期限が切れていないか */
export function isTrialActive(user: BillingUser | null): boolean {
  if (!user) return false;
  if (user.plan !== 'free') return true;
  if (!user.trialEndsAt) return false;
  return new Date(user.trialEndsAt).getTime() > Date.now();
}

/**
 * 無料トライアルが「終了済み」か (= 画面をロックして課金へ誘導すべき状態)。
 * - free プランで trialEndsAt が過去 → true
 * - 有料プラン / トライアル中 / 期限未設定 → false
 * master モードはここでは判定しない (呼び出し側で isMasterAuth を併用)。
 */
export function isTrialExpired(user: BillingUser | null): boolean {
  if (!user) return false;
  if (user.plan !== 'free') return false;
  if (!user.trialEndsAt) return false;
  return new Date(user.trialEndsAt).getTime() <= Date.now();
}

/** アプリにアクセスできる状態か (master or 有効な signup) */
export function isAuthorized(): boolean {
  if (isMasterAuth()) return true;
  const u = loadBillingUser();
  if (!u) return false;
  // free プランでトライアル切れならアクセス不可
  if (u.plan === 'free' && !isTrialActive(u)) return false;
  return true;
}

/** 有効プラン: master モードなら 'studio' 相当 (全機能解放) */
export function getEffectivePlan(user: BillingUser | null): PlanId {
  if (isMasterAuth()) return 'studio';
  return user?.plan || 'free';
}

/**
 * 機能を使う前に呼ぶ厳格チェック。
 * - 許可: { ok: true } を返す
 * - 拒否: { ok: false, reason, upgradeTo? } を返す
 * - 許可された場合、自動でカウントアップする (count を増やしたくないなら dryRun: true)
 */
export function enforceFeature(
  feature: FeatureKey,
  options?: { dryRun?: boolean },
): { ok: true; remaining?: number } | { ok: false; reason: string; upgradeTo?: PlanId } {
  // マスターモードは無制限
  if (isMasterAuth()) return { ok: true };

  const user = loadBillingUser();
  if (!user) {
    return { ok: false, reason: 'ログインが必要です。アカウントを作成してください。' };
  }

  // free プラントライアル期限チェック
  if (user.plan === 'free' && !isTrialActive(user)) {
    return { ok: false, reason: '7 日間トライアルが終了しました。プランをアップグレードしてください。', upgradeTo: 'standard' };
  }

  const plan = user.plan;
  const check = checkFeature(plan, feature);

  if (check.unavailable) {
    const meta = FEATURE_META[feature];
    return {
      ok: false,
      reason: `「${meta.label}」は現在のプラン (${plan}) では利用できません。`,
      upgradeTo: check.upgradeTo,
    };
  }

  if (typeof check.limit === 'number') {
    const used = getUsageCount(feature);
    if (used >= check.limit) {
      const meta = FEATURE_META[feature];
      return {
        ok: false,
        reason: `「${meta.label}」の今月の利用上限 (${check.limit} 回) に達しました。`,
        upgradeTo: 'standard',
      };
    }
    if (!options?.dryRun) {
      incrementUsage(feature);
    }
    return { ok: true, remaining: check.limit - used - (options?.dryRun ? 0 : 1) };
  }

  // unlimited
  return { ok: true };
}

// ─── 現在のユーザー (テスト版: localStorage で管理) ───
const KEY_USER = 'core_billing_user_v1';

export interface BillingUser {
  email: string;
  /** SHA-256 ハッシュで保存 (簡易) */
  passwordHash: string;
  brand: Brand;
  plan: PlanId;
  /** 開始日 (ISO) */
  startedAt: string;
  /** トライアル終了日 (ISO) — free のみ */
  trialEndsAt?: string;
  /** Stripe Customer ID (本番のみ) */
  stripeCustomerId?: string;
  /** Stripe Subscription ID (解約処理に使う) */
  subscriptionId?: string;
  /** サブスクリプション次回更新日 (Unix タイムスタンプ秒、Stripe webhook で同期) */
  currentPeriodEnd?: number;
  /** プラン有効期限 (ISO) — /api/stripe/sync が更新。currentPeriodEnd と同義だが表示用 */
  planExpiresAt?: string;
  /** 課金停止中 (past_due / unpaid) — banner 表示用 */
  delinquent?: boolean;
  /** テスト版で ¥0 で進めたか */
  isTestCheckout?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Cookie 永続層 (Safari ITP / incognito localStorage 揮発対策) ─────
// 400 日 (max-age 上限) で長期セッション
const COOKIE_USER = 'core_user';
function setCookie(name: string, value: string, maxAgeSec = 400 * 86400) {
  try {
    const v = encodeURIComponent(value);
    document.cookie = `${name}=${v}; max-age=${maxAgeSec}; path=/; SameSite=Lax`;
  } catch {/* */}
}
function getCookie(name: string): string | null {
  try {
    const m = document.cookie.split('; ').find(c => c.startsWith(name + '='));
    return m ? decodeURIComponent(m.substring(name.length + 1)) : null;
  } catch { return null; }
}
function delCookie(name: string) {
  try { document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`; } catch {/* */}
}

export function loadBillingUser(): BillingUser | null {
  // 1. localStorage 優先
  try {
    const r = localStorage.getItem(KEY_USER);
    if (r) return JSON.parse(r);
  } catch {/* */}
  // 2. cookie フォールバック (Safari ITP / 揮発で localStorage が消えてもログイン状態を維持)
  try {
    const cookieVal = getCookie(COOKIE_USER);
    if (cookieVal) {
      const parsed = JSON.parse(cookieVal) as BillingUser;
      // 復元成功 → localStorage に書き戻して以降は速い経路で
      try { localStorage.setItem(KEY_USER, cookieVal); } catch {/* */}
      console.info('[billing] localStorage missing — restored from cookie');
      return parsed;
    }
  } catch {/* */}
  return null;
}

export function saveBillingUser(u: BillingUser) {
  const json = JSON.stringify(u);
  try { localStorage.setItem(KEY_USER, json); } catch {/* */}
  // 二重保存: 400 日 cookie (localStorage が揮発しても復元可能)
  setCookie(COOKIE_USER, json);
}

export function clearBillingUser() {
  try { localStorage.removeItem(KEY_USER); } catch {/* */}
  delCookie(COOKIE_USER);
}

/**
 * 現在のユーザーのトライアル期限を days 日ぶん延長する。
 * 招待者側の紹介ボーナス (友達が登録 → 招待者に +7 日) を実際の trialEndsAt に反映する用途。
 * - days <= 0 / ユーザー未ログインなら何もしない (現在の期限を返す or null)。
 * - trialEndsAt 未設定でも、今より先の期限を作って延長する (有料化前に登録した招待者を救済)。
 * @returns 延長後の trialEndsAt (ISO) — 適用しなかった場合は既存値 or null
 */
export function extendTrial(days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) {
    return loadBillingUser()?.trialEndsAt ?? null;
  }
  const u = loadBillingUser();
  if (!u) return null;
  // 既存の期限が未来ならそこから、過去 or 未設定なら今から起算
  const base = u.trialEndsAt && new Date(u.trialEndsAt).getTime() > Date.now()
    ? new Date(u.trialEndsAt).getTime()
    : Date.now();
  const next = new Date(base + days * 86400000).toISOString();
  saveBillingUser({ ...u, trialEndsAt: next });
  return next;
}

/**
 * ログアウト + アプリゲート解除。
 * - billing user (localStorage + cookie) を削除
 * - APP_ENTERED フラグを削除 → 次の表示で LP に戻す
 * - 任意で全 localStorage を初期化 (= 完全リセット)
 */
export function signOutAndExit(opts?: { fullReset?: boolean }): void {
  try {
    clearBillingUser();
    if (typeof localStorage !== 'undefined') {
      // 必ず消すキー: アプリゲート + Owner フラグ
      localStorage.removeItem('core_app_entered_v1');
      localStorage.removeItem('core_master_key_v1');
      // PrismSplash の SessionStorage は維持しない (再ログイン時の歓迎演出のため)
      try { sessionStorage.removeItem('prism_welcome_seen_v2'); } catch {/* */}
      if (opts?.fullReset) {
        // 全ローカルデータ削除 (ナレッジ / 履歴 / 設定など)
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.push(k);
        }
        keys.forEach(k => {
          try { localStorage.removeItem(k); } catch {/* */}
        });
      }
    }
  } catch {/* */}
}

export function useBillingUser(): {
  user: BillingUser | null;
  signup: (input: { email: string; password: string; brand: Brand; plan: PlanId }) => Promise<BillingUser>;
  signout: () => void;
  changePlan: (plan: PlanId) => void;
} {
  const [user, setUser] = useState<BillingUser | null>(() => loadBillingUser());

  // 他タブとの同期
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_USER) setUser(loadBillingUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signup = useCallback(async (input: { email: string; password: string; brand: Brand; plan: PlanId }) => {
    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    // 保留中の紹介コードがあれば API 経由で検証 → +7 日延長
    let bonusDays = 0;
    try {
      const r = await _redeemPendingReferral(input.email);
      if (r.ok) bonusDays = r.bonusDays;
    } catch { /* UX を止めない */ }

    const trialDays = (input.plan === 'free' ? 7 : 0) + bonusDays;
    const trialEndsAt = trialDays > 0
      ? new Date(now.getTime() + trialDays * 86400000).toISOString()
      : undefined;

    const u: BillingUser = {
      email: input.email,
      passwordHash,
      brand: input.brand,
      plan: input.plan,
      startedAt: now.toISOString(),
      trialEndsAt,
      isTestCheckout: input.plan !== 'free',  // ¥0 でテスト購入したフラグ
    };
    saveBillingUser(u);
    setUser(u);
    return u;
  }, []);

  const signout = useCallback(() => {
    clearBillingUser();
    setUser(null);
  }, []);

  const changePlan = useCallback((plan: PlanId) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, plan, isTestCheckout: plan !== 'free' };
      saveBillingUser(next);
      return next;
    });
  }, []);

  return { user, signup, signout, changePlan };
}

// ============================================================
//  Phase D: Stripe 完全連携 (tenant 1:1)
// ============================================================

/** プランをアップグレード/ダウングレード (既存サブスクの price を差し替え) */
export async function updateSubscriptionPlan(input: {
  subscriptionId: string;
  brand: Brand;
  plan: PlanId;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const resp = await fetch('/api/stripe/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_id: input.subscriptionId,
        plan: input.plan,
        brand: input.brand,
      }),
    });
    const data = await resp.json() as { success?: boolean; error?: string; current_period_end?: number };
    if (!resp.ok || !data.success) return { ok: false, message: data.error || 'プラン変更に失敗しました' };

    // ローカル user を即時更新
    const u = loadBillingUser();
    if (u) {
      saveBillingUser({
        ...u,
        plan: input.plan,
        currentPeriodEnd: data.current_period_end ?? u.currentPeriodEnd,
        isTestCheckout: false,
      });
    }
    return { ok: true, message: 'プランを変更しました' };
  } catch (e: any) {
    return { ok: false, message: e.message || 'ネットワークエラー' };
  }
}

/** Stripe Billing Portal セッションを発行して URL を返す */
export async function openBillingPortal(customerId: string): Promise<{ ok: boolean; url?: string; message?: string }> {
  try {
    const resp = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, return_url: window.location.href }),
    });
    const data = await resp.json() as { url?: string; error?: string };
    if (!resp.ok || !data.url) return { ok: false, message: data.error || 'ポータルを開けません' };
    return { ok: true, url: data.url };
  } catch (e: any) {
    return { ok: false, message: e.message || 'ネットワークエラー' };
  }
}

/**
 * 課金失敗 (past_due / unpaid / incomplete) 救済用 — 現ユーザーの Stripe Customer Portal URL を取得。
 * - customer_id が無くても subscription_id から自動で逆引き
 * - エラー時は null を返す (呼び出し側で alert / banner に出す)
 */
export async function getCustomerPortalUrl(): Promise<string | null> {
  const u = loadBillingUser();
  if (!u) return null;
  try {
    const resp = await fetch('/api/billing/portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: u.stripeCustomerId,
        subscription_id: u.subscriptionId,
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    });
    const data = await resp.json() as { url?: string; error?: string };
    if (!resp.ok || !data.url) return null;
    return data.url;
  } catch {
    return null;
  }
}

/**
 * Subscription の状態 (Stripe webhook で同期された値) を読む。
 * 課金失敗のときに UI バナーを出すために使う。
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'canceled' | 'paused' | 'unknown';

export function getSubscriptionStatus(user: BillingUser | null): SubscriptionStatus {
  if (!user) return 'unknown';
  // delinquent フラグが webhook で立っていれば past_due 相当
  if (user.delinquent) return 'past_due';
  // それ以外は active 相当 (今のデータ構造では細かい status は保持していない)
  if (user.subscriptionId) return 'active';
  return 'unknown';
}

/** 課金失敗中か (past_due / unpaid / incomplete) */
export function isBillingDelinquent(user: BillingUser | null): boolean {
  if (!user) return false;
  return user.delinquent === true;
}

// ─── Stripe セッション照会によるプラン同期 ───

export type StripeLookupResult = { ok: boolean; plan?: PlanId; info?: StripeSessionInfo };

export interface StripeSessionInfo {
  plan: PlanId | null;
  brand: Brand | null;
  status: string;
  customer_email: string | null;
  subscription_id: string | null;
  current_period_end: number | null;
}

// ─── /api/stripe/sync でローカル subscription 状態を同期 ───
export interface SubscriptionSyncResult {
  ok: boolean;
  status?: string;
  plan?: string | null;
  brand?: string | null;
  current_period_end?: number | null;
  plan_expires_at?: string | null;
  cancel_at_period_end?: boolean;
  delinquent?: boolean;
  downgrade_to_free?: boolean;
  /** ローカル状態が変わったか (UI 再描画判定用) */
  changed?: boolean;
}

const SYNC_THROTTLE_KEY = 'core_billing_last_sync_v1';
const SYNC_MIN_INTERVAL_MS = 60 * 1000; // 1 分以内の再同期は省略

/**
 * フロント起動時に呼ぶ: webhook が記録した状態 + Stripe 真偽値で
 * localStorage の core_user (plan / planExpiresAt / delinquent) を更新する。
 * マスターモードは何もしない。
 */
export async function syncSubscriptionState(opts?: { force?: boolean }): Promise<SubscriptionSyncResult> {
  if (isMasterAuth()) return { ok: true };
  const user = loadBillingUser();
  if (!user || !user.subscriptionId) return { ok: false };

  // スロットル
  if (!opts?.force) {
    try {
      const last = parseInt(localStorage.getItem(SYNC_THROTTLE_KEY) || '0', 10);
      if (Date.now() - last < SYNC_MIN_INTERVAL_MS) return { ok: true };
    } catch { /* */ }
  }

  let resp: Response;
  try {
    resp = await fetch('/api/stripe/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_id: user.subscriptionId,
        customer_id: user.stripeCustomerId,
      }),
    });
  } catch {
    return { ok: false };
  }

  let data: SubscriptionSyncResult & { plan_expires_at?: string | null } = { ok: false };
  try { data = await resp.json(); } catch { /* */ }
  if (!resp.ok || !data.ok) return { ok: false };

  try { localStorage.setItem(SYNC_THROTTLE_KEY, String(Date.now())); } catch { /* */ }

  // localStorage 反映
  let changed = false;
  const next: BillingUser = { ...user };

  if (data.plan_expires_at && next.planExpiresAt !== data.plan_expires_at) {
    next.planExpiresAt = data.plan_expires_at;
    changed = true;
  }
  if (typeof data.current_period_end === 'number' && next.currentPeriodEnd !== data.current_period_end) {
    next.currentPeriodEnd = data.current_period_end;
    changed = true;
  }
  if (typeof data.delinquent === 'boolean' && next.delinquent !== data.delinquent) {
    next.delinquent = data.delinquent;
    changed = true;
  }
  if (data.downgrade_to_free && next.plan !== 'free') {
    next.plan = 'free';
    next.isTestCheckout = false;
    next.subscriptionId = undefined;
    changed = true;
  }

  if (changed) saveBillingUser(next);

  return { ...data, changed };
}

/**
 * /api/billing/lookup を叩いてプランを確定し localStorage を更新する。
 * マスターモードはバイパス。
 */
export async function syncFromStripe(sessionId: string): Promise<{ ok: boolean; plan?: PlanId; info?: StripeSessionInfo }> {
  if (isMasterAuth()) return { ok: true };
  try {
    const resp = await fetch(`/api/billing/lookup?session_id=${encodeURIComponent(sessionId)}`);
    if (!resp.ok) return { ok: false };
    const info: StripeSessionInfo = await resp.json();
    if (info.plan) {
      const user = loadBillingUser();
      if (user) {
        const updated: BillingUser = {
          ...user,
          plan: info.plan,
          isTestCheckout: false,
          subscriptionId: info.subscription_id ?? user.subscriptionId,
          currentPeriodEnd: info.current_period_end ?? user.currentPeriodEnd,
        };
        saveBillingUser(updated);
      }
      return { ok: true, plan: info.plan, info };
    }
    return { ok: false, info };
  } catch {
    return { ok: false };
  }
}
