// ============================================================
// revenue — 実売上の取込み・キャッシュ・手動上書きレイヤー
// ソース: /api/revenue/snapshot (Stripe)
// キャッシュ: localStorage core_revenue_actuals_v1 (最終取得値)
// 手動上書き: localStorage core_revenue_overrides_v1 (オーナーが /strategy で編集)
// ============================================================

export type Brand = 'prism' | 'iris' | 'other';

export interface ProductMrr { mrrJpy: number; paidCount: number; }

export interface MonthlyPoint {
  month: string;       // 'YYYY-MM'
  mrrJpy: number;
  prismJpy: number;
  irisJpy: number;
  otherJpy: number;
  gmvJpy: number;
}

export interface RevenueSnapshot {
  asOf: string;
  stripeConfigured: boolean;
  productsConfigured?: { prism: boolean; iris: boolean };
  totals: {
    mrrJpy: number;
    paidCount: number;
    arrJpy: number;
    prismMrrJpy: number;
    irisMrrJpy: number;
    otherMrrJpy: number;
  };
  byProduct: Record<Brand, ProductMrr>;
  monthly: MonthlyPoint[];
  source: 'stripe' | 'override' | 'cache' | 'empty';
  error?: string;
}

export interface RevenueOverride {
  mrrJpy?: number | null;
  arpuJpy?: number | null;
  paidCount?: number | null;
  prismMrrJpy?: number | null;
  irisMrrJpy?: number | null;
  // 月次手動値: { 'YYYY-MM': { prismJpy, irisJpy } }
  monthly?: Record<string, { prismJpy?: number; irisJpy?: number; otherJpy?: number }>;
  note?: string;
  updatedAt?: string;
}

const CACHE_KEY = 'core_revenue_actuals_v1';
const OVERRIDE_KEY = 'core_revenue_overrides_v1';
const MASTER_KEY = 'core_master_key_v1';

function getMasterKey(): string | null {
  try { return localStorage.getItem(MASTER_KEY); } catch { return null; }
}

export function readOverride(): RevenueOverride {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function writeOverride(patch: Partial<RevenueOverride>): RevenueOverride {
  const cur = readOverride();
  const next: RevenueOverride = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next)); } catch { /* */ }
  return next;
}

export function clearOverride(): void {
  try { localStorage.removeItem(OVERRIDE_KEY); } catch { /* */ }
}

function readCache(): RevenueSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RevenueSnapshot;
  } catch { return null; }
}

function writeCache(snap: RevenueSnapshot): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch { /* */ }
}

function makeMonths(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function emptySnapshot(): RevenueSnapshot {
  return {
    asOf: new Date().toISOString(),
    stripeConfigured: false,
    totals: { mrrJpy: 0, paidCount: 0, arrJpy: 0, prismMrrJpy: 0, irisMrrJpy: 0, otherMrrJpy: 0 },
    byProduct: {
      prism: { mrrJpy: 0, paidCount: 0 },
      iris: { mrrJpy: 0, paidCount: 0 },
      other: { mrrJpy: 0, paidCount: 0 },
    },
    monthly: makeMonths().map(m => ({ month: m, mrrJpy: 0, prismJpy: 0, irisJpy: 0, otherJpy: 0, gmvJpy: 0 })),
    source: 'empty',
  };
}

/** 上書きを適用 (Stripe 値を override で書き換える) */
function applyOverride(snap: RevenueSnapshot, ov: RevenueOverride): RevenueSnapshot {
  const next: RevenueSnapshot = JSON.parse(JSON.stringify(snap));
  let touched = false;
  if (typeof ov.mrrJpy === 'number') { next.totals.mrrJpy = ov.mrrJpy; next.totals.arrJpy = ov.mrrJpy * 12; touched = true; }
  if (typeof ov.paidCount === 'number') { next.totals.paidCount = ov.paidCount; touched = true; }
  if (typeof ov.prismMrrJpy === 'number') {
    next.totals.prismMrrJpy = ov.prismMrrJpy;
    next.byProduct.prism.mrrJpy = ov.prismMrrJpy;
    touched = true;
  }
  if (typeof ov.irisMrrJpy === 'number') {
    next.totals.irisMrrJpy = ov.irisMrrJpy;
    next.byProduct.iris.mrrJpy = ov.irisMrrJpy;
    touched = true;
  }
  if (ov.monthly) {
    for (const m of next.monthly) {
      const o = ov.monthly[m.month];
      if (!o) continue;
      if (typeof o.prismJpy === 'number') { m.prismJpy = o.prismJpy; touched = true; }
      if (typeof o.irisJpy === 'number') { m.irisJpy = o.irisJpy; touched = true; }
      if (typeof o.otherJpy === 'number') { m.otherJpy = o.otherJpy; touched = true; }
      m.mrrJpy = m.prismJpy + m.irisJpy + m.otherJpy;
    }
  }
  if (touched) next.source = 'override';
  return next;
}

/** /api/revenue/snapshot を呼び、override / cache / empty フォールバックを返す */
export async function fetchRevenueSnapshot(): Promise<RevenueSnapshot> {
  const override = readOverride();
  const masterKey = getMasterKey();

  let snap: RevenueSnapshot;
  try {
    const headers: Record<string, string> = {};
    if (masterKey) headers['x-master-key'] = masterKey;
    const resp = await fetch('/api/revenue/snapshot', { headers });
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // dev (Vite) や 404 で HTML / TS ソースが返るケース。キャッシュフォールバック
      const cached = readCache();
      snap = cached ? { ...cached, source: 'cache' } : {
        ...emptySnapshot(),
        error: 'API 未デプロイ (dev モード)',
      };
    } else {
      const j = await resp.json();
      if (resp.ok) {
        snap = { ...emptySnapshot(), ...j, source: 'stripe' };
        writeCache(snap);
      } else {
        const cached = readCache();
        snap = cached ? { ...cached, source: 'cache' } : {
          ...emptySnapshot(),
          error: j?.error || `HTTP ${resp.status}`,
        };
      }
    }
  } catch (e: any) {
    const cached = readCache();
    snap = cached ? { ...cached, source: 'cache' } : {
      ...emptySnapshot(),
      error: String(e?.message || e),
    };
  }

  // Override (UI 編集値) を最終適用
  return applyOverride(snap, override);
}

// ─── Format ヘルパー ───
export function fmtJpy(n: number): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

export function fmtJpyShort(n: number): string {
  if (Math.abs(n) >= 100_000_000) return '¥' + (n / 100_000_000).toFixed(1) + '億';
  if (Math.abs(n) >= 10_000)     return '¥' + (n / 10_000).toFixed(1).replace(/\.0$/, '') + '万';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

export function fmtGapRatio(actual: number, target: number): string {
  if (target <= 0) return '—';
  const r = (actual / target) * 100;
  return `${r.toFixed(0)}%`;
}

export function fmtGapDelta(actual: number, target: number): string {
  const diff = actual - target;
  const sign = diff >= 0 ? '+' : '−';
  return sign + fmtJpyShort(Math.abs(diff));
}
