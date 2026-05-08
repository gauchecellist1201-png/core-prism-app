// ============================================================
// Billing — プラン定義 + 現在のプラン管理 + Stripe URL フック
// ============================================================
import { useCallback, useEffect, useState } from 'react';

export type PlanId = 'free' | 'lite' | 'standard' | 'pro' | 'studio';
export type Brand = 'iris' | 'prism';

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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい O,0,I,1 除外
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
    return { success: false, message: 'すでに紹介コードを利用済みです' };
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
