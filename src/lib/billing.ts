// ============================================================
// Billing — プラン定義 + 現在のプラン管理 + Stripe URL フック
// ============================================================
import { useCallback, useEffect, useState } from 'react';

export type PlanId = 'free' | 'lite' | 'standard' | 'pro' | 'studio';
export type Brand = 'iris' | 'prism';

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
    'api-access': 'unlimited',
    'white-label': 'unlimited',
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
    name: 'Lite', priceJpy: 1980, priceJpy_yearly: 19800,
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
    name: 'Standard', priceJpy: 4980, priceJpy_yearly: 49800,
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
    name: 'Pro', priceJpy: 9800, priceJpy_yearly: 98000,
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
  {
    id: 'studio', brand: 'iris',
    name: 'Studio', priceJpy: 29800, priceJpy_yearly: 298000,
    tagline: '事務所・代理店',
    features: [
      'Pro 全機能',
      '連携アカウント 無制限',
      'ホワイトラベル可 (自社ブランド)',
      'API 連携 (Salesforce 等)',
      '月次オンライン研修',
      'API キー専有',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_IRIS_STUDIO_URL',
    stripeUrlEnvKey_yearly: 'VITE_STRIPE_IRIS_STUDIO_YEARLY_URL',
  },
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
    name: 'Starter', priceJpy: 4980, priceJpy_yearly: 49800,
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

export function getPlans(brand: Brand): Plan[] {
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
