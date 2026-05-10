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
  'white-label':       { label: 'ホワイトラベル',     emoji: '🎦' },
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

export interface Plan {
  id: PlanId;
  brand: Brand | 'both';
  name: string;
  priceJpy: number;
  badge?: string;
  tagline: string;
  features: string[];
  /** 正式リリース時に Stripe Checkout URL を入れる (env 経由) */
  stripeUrlEnvKey?: string;
}

export const IRIS_PLANS: Plan[] = [
  {
    id: 'free', brand: 'iris',
    name: '14 日間 無料トライアル', priceJpy: 0,
    tagline: 'まずは試す',
    features: ['全機能 14 日間 試せる', 'カード登録不要', '自動課金なし'],
  },
  {
    id: 'lite', brand: 'iris',
    name: 'Lite', priceJpy: 1980,
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
  },
  {
    id: 'standard', brand: 'iris',
    name: 'Standard', priceJpy: 4980,
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
  },
  {
    id: 'pro', brand: 'iris',
    name: 'Pro', priceJpy: 9800,
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
  },
  {
    id: 'studio', brand: 'iris',
    name: 'Studio', priceJpy: 29800,
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
  },
];

export const PRISM_PLANS: Plan[] = [
  {
    id: 'free', brand: 'prism',
    name: '14 日間 無料トライアル', priceJpy: 0,
    tagline: 'まずは試す',
    features: ['全機能 14 日間 試せる', 'カード登録不要', '自動課金なし'],
  },
  {
    id: 'lite', brand: 'prism',
    name: 'Starter', priceJpy: 4980,
    tagline: '個人・スタートアップ',
    features: [
      '基本 AI 機能',
      '1 人格 / 1 ユーザー',
      'ナレッジ 100 件まで',
      'コミュニティサポート',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_STARTER_URL',
  },
  {
    id: 'standard', brand: 'prism',
    name: 'Standard', priceJpy: 9800,
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
  },
  {
    id: 'pro', brand: 'prism',
    name: 'Exclusive', priceJpy: 29800,
    tagline: 'プロフェッショナル / 経営者',
    features: [
      'Standard 全機能',
      '専任カスタマーサクセス',
      '優先サポート (1 営業日)',
      'カスタム連携 (Salesforce 等)',
      '社内研修 / 導入伴走',
    ],
    stripeUrlEnvKey: 'VITE_STRIPE_PRISM_EXCLUSIVE_URL',
  },
];

export function getPlans(brand: Brand): Plan[] {
  return brand === 'iris' ? IRIS_PLANS : PRISM_PLANS;
}

export function findPlan(brand: Brand, id: PlanId): Plan | undefined {
  return getPlans(brand).find(p => p.id === id);
}

/** 環境変数から Stripe URL を取得 (本番リリース時に値を入れる) */
export function getStripeCheckoutUrl(plan: Plan): string | null {
  if (!plan.stripeUrlEnvKey) return null;
  const url = (import.meta.env as Record<string, string | undefined>)[plan.stripeUrlEnvKey];
  return url || null;
}

// ─── 紹介プログラム (1 人紹介 → 両者 1 ヶ月無料) ───
const KEY_REFERRAL = 'core_referral_v1';

export interface ReferralData {
  /** あなたの紹介コード (8 文字、ランダム) */
  myCode: string;
  /** 紹介経由でサインアップした人数 */
  referredCount: number;
  /** あなたが利用した紹介コード (誰の紹介で来たか) */
  usedCode?: string;
  /** 累計の延長月数 (1 紹介 = 1 ヶ月) */
  bonusMonths: number;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 級らわしい O,0,I,1 除外
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function getReferralData(): ReferralData {
  try {
    const r = localStorage.getItem(KEY_REFERRAL);
    if (r) return JSON.parse(r);
  } catch { /* */ }
  // 初期化
  const initial: ReferralData = {
    myCode: generateReferralCode(),
    referredCount: 0,
    bonusMonths: 0,
  };
  try { localStorage.setItem(KEY_REFERRAL, JSON.stringify(initial)); } catch { /* */ }
  return initial;
}

export function saveReferralData(data: ReferralData) {
  try { localStorage.setItem(KEY_REFERRAL, JSON.stringify(data)); } catch { /* */ }
}

export function applyReferralCode(code: string): { success: boolean; message: string } {
  const data = getReferralData();
  if (data.usedCode) {
    return { success: false, message: 'すでに紹介コードを利用済です' };
  }
  if (code === data.myCode) {
    return { success: false, message: '自分の紹介コードは使えません' };
  }
  if (code.length < 6) {
    return { success: false, message: '紹介コードが短すぎます' };
  }
  data.usedCode = code;
  data.bonusMonths += 1;
  saveReferralData(data);
  return { success: true, message: '🎉 1 ヶ月の無料延長が適用されました!' };
}

export function getReferralUrl(brand: 'iris' | 'prism', code: string): string {
  const base = brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris'
    : 'https://core-prism-app.vercel.app/';
  return `${base}?ref=${code}`;
}

// URL クエリの ?ref=XXX を読み取って自動適用
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref && ref.length >= 6) {
      const data = getReferralData();
      if (!data.usedCode) {
        // 一旦保存 (サインアップ完了時に確定)
        sessionStorage.setItem('pending_ref', ref);
      }
      // URL から ref パラメータを除去 (キレイに見せる)
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
    }
  } catch { /* */ }
}

// ============================================================
//  アクセスゲート
// ============================================================

/** マスターキー (オーナー専用 GAUCHE2026) で全機能アクセス可能か */
export function isMasterAuth(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('core_master_key_v1') === 'GAUCHE2026';
  } catch {
    return false;
  }
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
    return { ok: false, reason: '14 日間トライアルが終了しました。プランをアップグレードしてください。', upgradeTo: 'standard' };
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

export function loadBillingUser(): BillingUser | null {
  try {
    const r = localStorage.getItem(KEY_USER);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

export function saveBillingUser(u: BillingUser) {
  try { localStorage.setItem(KEY_USER, JSON.stringify(u)); } catch { /* */ }
}

export function clearBillingUser() {
  try { localStorage.removeItem(KEY_USER); } catch { /* */ }
}

// ─── Stripe セッション同期 ───
export interface StripeLookupResult {
  plan: PlanId;
  brand: Brand;
  status: string;
  customer_email: string | null;
  subscription_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
}

/**
 * Stripe Checkout 完了後、session_id を使ってサーバから plan を取得し
 * ローカルの BillingUser を更新する。
 * マスターモード (GAUCHE2026) の場合はバイパスして即 resolve。
 */
export async function syncFromStripe(sessionId: string): Promise<StripeLookupResult | null> {
  if (isMasterAuth()) return null;
  try {
    const res = await fetch(`/api/billing/lookup?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as StripeLookupResult;
    const user = loadBillingUser();
    if (user) {
      const updated: BillingUser = {
        ...user,
        plan: data.plan,
        stripeCustomerId: data.subscription_id ?? user.stripeCustomerId,
        isTestCheckout: false,
      };
      saveBillingUser(updated);
    }
    return data;
  } catch {
    return null;
  }
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

    // 保留中の紹介コードがあれば適用 (URL 経由 ?ref=XXX)
    let bonusDays = 0;
    try {
      const pendingRef = sessionStorage.getItem('pending_ref');
      if (pendingRef) {
        const r = applyReferralCode(pendingRef);
        if (r.success) bonusDays = 30;
        sessionStorage.removeItem('pending_ref');
      }
    } catch { /* */ }

    const trialDays = (input.plan === 'free' ? 14 : 0) + bonusDays;
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
