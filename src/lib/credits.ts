// ============================================================
// credits.ts — クレジット (月間使用量) 管理
//
// オーナー指示 (2026-05-28):
// 「月額の利用料は上限超えたら自分で買い足す」設計。
//
// プラン:
//   light     ¥2,980 / 200 クレジット
//   standard  ¥9,800 / 1,000 クレジット ⭐ 主力
//   pro      ¥19,800 / 3,500 クレジット
//   team     ¥49,800 / 10,000 クレジット
//
// 上限超え → Top-up (¥500 / +200, ¥2,000 / +1,000, ¥4,500 / +2,500)
// 100 クレジットの猶予 (急に止まらないやさしさ)
// ============================================================

export type PlanId = 'light' | 'standard' | 'pro' | 'team' | 'master';

export interface PlanDef {
  id: PlanId;
  name: string;
  jpy: number;
  credits: number;
  emoji: string;
  tagline: string;
  perks: string[];
}

export const PLANS: Record<Exclude<PlanId, 'master'>, PlanDef> = {
  light: {
    id: 'light',
    name: 'ライト',
    jpy: 2980,
    credits: 200,
    emoji: '🌱',
    tagline: 'まずは試してみたい人',
    perks: ['全エージェント利用可', 'クレジット 200/月', '基本サポート'],
  },
  standard: {
    id: 'standard',
    name: 'スタンダード',
    jpy: 9800,
    credits: 1000,
    emoji: '⭐',
    tagline: '主力プラン・ほぼ全員はこれ',
    perks: ['クレジット 1,000/月', '全機能 + Stripe 連携', '優先処理'],
  },
  pro: {
    id: 'pro',
    name: 'プロ',
    jpy: 19800,
    credits: 3500,
    emoji: '🚀',
    tagline: '毎日たくさん使う人',
    perks: ['クレジット 3,500/月', '優先処理 + 大容量', 'AI 速度 2 倍'],
  },
  team: {
    id: 'team',
    name: 'チーム',
    jpy: 49800,
    credits: 10000,
    emoji: '🏢',
    tagline: '法人・チーム',
    perks: ['クレジット 10,000/月', 'メンバー 5 名招待', '専任サポート'],
  },
};

export interface TopUpPack {
  id: string;
  credits: number;
  jpy: number;
  perCredit: number;
  saving?: string;
}

export const TOP_UPS: TopUpPack[] = [
  { id: 'sm', credits: 200, jpy: 500, perCredit: 2.5 },
  { id: 'md', credits: 1000, jpy: 2000, perCredit: 2.0, saving: '20% お得' },
  { id: 'lg', credits: 2500, jpy: 4500, perCredit: 1.8, saving: '28% お得' },
];

/**
 * アクションごとのクレジット消費量。
 * ユーザーに分かりやすい単位 (1 / 2 / 3 / 5 / 8) で。
 */
export const ACTION_COSTS = {
  brief: 1,          // 今日の一言 / 通常の AI 提案
  script: 2,         // 商談台本 / 戦略分析 / 議事録要約
  slide: 3,          // スライド / 横断インサイト
  image: 5,          // 画像生成
  meeting: 8,        // 会議録音 → 議事録 (10 分)
} as const;

export type ActionKind = keyof typeof ACTION_COSTS;

// ─── localStorage 永続化 ─────────────────
const KEY = 'core_credits_v1';
const PLAN_KEY = 'core_plan_v1';

interface CreditState {
  used: number;            // 今月の累積消費
  addonRemaining: number;  // Top-up で買い足した残量
  periodStart: string;     // 月初 (ISO)
  history: Array<{ at: string; kind: ActionKind; cost: number; label?: string }>;
}

function currentMonthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function loadState(): CreditState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as CreditState;
      // 月をまたいだら自動リセット
      const now = currentMonthStart();
      if (s.periodStart !== now) {
        return { used: 0, addonRemaining: s.addonRemaining || 0, periodStart: now, history: [] };
      }
      return s;
    }
  } catch { /* */ }
  return { used: 0, addonRemaining: 0, periodStart: currentMonthStart(), history: [] };
}

function saveState(s: CreditState): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, history: s.history.slice(-100) })); } catch { /* */ }
  window.dispatchEvent(new CustomEvent('core:credits-updated'));
}

// ─── プラン管理 ────────────────────────
/**
 * 契約プラン (billing.ts の PlanId) → クレジット体系のプラン。
 * billing.ts 側が「実際に請求している契約」の正本なので、使える量もそこから決める。
 */
const CREDIT_PLAN_OF_BILLING: Record<string, Exclude<PlanId, 'master'>> = {
  // v1
  lite: 'light',
  standard: 'standard',
  pro: 'pro',
  studio: 'team',
  agency: 'team',
  // v2 (2026-06-03 オーナー承認の体系。ここに無いと、実際に払った人が
  //     トライアルの枠まで落ちる — 2026-08-14 の Codex 指摘で発覚)
  'v2-btoC-light': 'light',
  'v2-btoC-standard': 'standard',
  'v2-btoC-pro': 'pro',
  'v2-btoB-entry': 'standard',
  'v2-btoB-standard': 'pro',
  'v2-btoB-pro': 'team',
  'v2-enterprise': 'team',
};

/**
 * 契約しているプランを localStorage から直接読む。
 * billing.ts を import しないのは、credits.ts が billing.ts から参照される可能性があり、
 * 循環参照を持ち込みたくないため（形は billing.ts の BillingUser と同じ）。
 *
 * ここで isTestCheckout を弾かないのは意図的。billing.ts の enforceFeature() /
 * getEffectivePlan() は user.plan だけを見て機能を開ける。ここだけ厳しくすると
 * 「機能は使えるのにクレジットが無い」という、お客様には理由の分からない状態になる。
 * 「払っていない人に有料の権利を渡さない」のは登録時点 (CheckoutModal) で閉じる。
 */
function billingPlanId(): string | null {
  try {
    const raw = localStorage.getItem('core_billing_user_v1');
    if (!raw) return null;
    const u = JSON.parse(raw) as { plan?: string };
    if (!u?.plan || u.plan === 'free') return null;
    return u.plan;
  } catch { return null; }
}

export function getPlanId(): PlanId {
  // マスター (オーナー) は無制限
  try {
    if (localStorage.getItem('core_master_key_v1') === 'GAUCHE2026') return 'master';
  } catch { /* */ }

  // ★支払いが確認できている契約があれば、それを唯一の正本にする。
  //   PLAN_KEY はクライアントが自由に書ける値で、以前はここだけを見ていたため
  //   「Lite を買った人が Standard の枠をもらう」「上げても枠が増えない」が起きていた。
  const billing = billingPlanId();
  if (billing) {
    const mapped = CREDIT_PLAN_OF_BILLING[billing];
    if (mapped) return mapped;
  }

  // 契約が無い人 (無料トライアル中) の枠。有料の Standard と同額を配らない。
  // ここを 'standard' に戻すと、1 円も払っていない人が ¥9,800 分の枠を毎月もらう。
  return TRIAL_PLAN;
}

/** 無料トライアル中に使える枠 (オーナーが増減を決める 1 か所) */
const TRIAL_PLAN: Exclude<PlanId, 'master'> = 'light';

/**
 * 古い `core_plan_v1` を捨てる。
 * このキーは以前「Stripe を通らずにプランを切り替える」ボタンが書き込んでいたもので、
 * 残しておくと、無料で有料の枠をもらった状態がそのまま続いてしまう。
 * 書き込む側は 2026-08-14 に廃止済み（プランは決済の確認結果からしか決まらない）。
 */
export function discardLegacyPlanKey(): void {
  try {
    if (localStorage.getItem(PLAN_KEY) !== null) {
      localStorage.removeItem(PLAN_KEY);
      window.dispatchEvent(new CustomEvent('core:credits-updated'));
    }
  } catch { /* */ }
}

// 既存のお客様の端末に残っている分を、このモジュールを読み込んだ時点で 1 回だけ捨てる。
if (typeof window !== 'undefined') discardLegacyPlanKey();

export function getPlanLimit(): number {
  const id = getPlanId();
  if (id === 'master') return Infinity;
  return PLANS[id].credits;
}

// ─── 公開 API ─────────────────────────
export interface CreditView {
  used: number;
  limit: number;          // プラン上限 (master は Infinity)
  addon: number;          // Top-up 残量
  available: number;      // 残り使える数 (limit + addon - used)
  pct: number;            // 0-100 (master は常に 0)
  warning: 'none' | 'soft' | 'hard' | 'over';
  planId: PlanId;
  isMaster: boolean;
}

export function getCredits(): CreditView {
  const s = loadState();
  const planId = getPlanId();
  const limit = getPlanLimit();
  const addon = s.addonRemaining || 0;
  const total = limit + addon;
  const available = Math.max(0, total - s.used);
  const pct = limit === Infinity ? 0 : Math.min(100, (s.used / Math.max(1, limit)) * 100);
  const isMaster = planId === 'master';
  let warning: CreditView['warning'] = 'none';
  if (!isMaster) {
    if (s.used >= limit + addon + 100) warning = 'over';     // 猶予 100 も超えた
    else if (s.used >= limit + addon) warning = 'hard';      // 上限超え (Top-up 必要)
    else if (s.used >= limit * 0.8) warning = 'soft';        // 80% 警告
  }
  return { used: s.used, limit, addon, available, pct, warning, planId, isMaster };
}

/**
 * アクション消費を記録。残量不足なら false を返す。
 * master は常に true (記録だけする)。
 */
export function consume(kind: ActionKind, label?: string): { ok: boolean; cost: number; view: CreditView } {
  const cost = ACTION_COSTS[kind];
  const s = loadState();
  const planId = getPlanId();
  const limit = getPlanLimit();
  const isMaster = planId === 'master';
  const total = isMaster ? Infinity : (limit + (s.addonRemaining || 0));
  // 猶予 100 まで実行を許す
  const grace = 100;
  const canRun = isMaster || (s.used + cost) <= (total + grace);
  if (canRun) {
    s.used += cost;
    s.history.push({ at: new Date().toISOString(), kind, cost, label });
    saveState(s);
  }
  return { ok: canRun, cost, view: getCredits() };
}

/** Top-up: クレジットを追加 (Stripe 決済成功後に呼ぶ) */
export function applyTopUp(credits: number): void {
  const s = loadState();
  s.addonRemaining = (s.addonRemaining || 0) + credits;
  saveState(s);
}

/** デモ / テスト用: 消費をリセット */
export function resetCredits(): void {
  saveState({ used: 0, addonRemaining: 0, periodStart: currentMonthStart(), history: [] });
}
