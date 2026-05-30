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
export function getPlanId(): PlanId {
  // マスター (オーナー) は無制限
  try {
    if (localStorage.getItem('core_master_key_v1') === 'GAUCHE2026') return 'master';
    const p = localStorage.getItem(PLAN_KEY) as PlanId | null;
    if (p && (p in PLANS)) return p;
  } catch { /* */ }
  return 'standard'; // デフォルト
}

export function setPlanId(p: Exclude<PlanId, 'master'>): void {
  try { localStorage.setItem(PLAN_KEY, p); } catch { /* */ }
  window.dispatchEvent(new CustomEvent('core:credits-updated'));
}

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
