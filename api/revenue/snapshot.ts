// ============================================================
// /api/revenue/snapshot — 月別・プロダクト別 (Prism / Iris) の実売上スナップショット
// GET → {
//   asOf,
//   totals: { mrrJpy, paidCount, arrJpy },
//   byProduct: { prism: {...}, iris: {...}, other: {...} },
//   monthly: [{ month: '2026-05', mrrJpy, prismJpy, irisJpy, gmvJpy }, ...] // 直近 12 ヶ月
// }
// 認証: x-master-key === GAUCHE2026 (オーナー専用)
// STRIPE_SECRET_KEY が無い場合は 503 + 空シェイプを返す (graceful degradation)
// プロダクト判別: STRIPE_PRODUCT_PRISM / STRIPE_PRODUCT_IRIS の env var に
//   stripe Product ID (prod_xxx) を入れる。未設定時は metadata.brand で判定。
// ============================================================
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key, x-stripe-key',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

type Brand = 'prism' | 'iris' | 'other';

interface StripePrice {
  id?: string;
  product?: string;
  unit_amount?: number;
  currency?: string;
  recurring?: { interval?: string; interval_count?: number };
}
interface StripeSubItem {
  price?: StripePrice;
  quantity?: number;
}
interface StripeSubscription {
  id: string;
  status: string;
  created?: number;
  canceled_at?: number | null;
  current_period_start?: number;
  metadata?: Record<string, string>;
  items: { data: StripeSubItem[] };
}
interface StripeInvoice {
  id: string;
  status: string;
  amount_paid?: number;
  currency?: string;
  created?: number;
  lines?: { data: Array<{ price?: StripePrice; metadata?: Record<string, string> }> };
}
interface StripeList<T> { data: T[]; has_more: boolean; }

function monthlyAmountJpy(item: StripeSubItem): number {
  const amount = item.price?.unit_amount || 0;
  const qty = item.quantity || 1;
  const interval = item.price?.recurring?.interval || 'month';
  const intervalCount = item.price?.recurring?.interval_count || 1;
  const currency = (item.price?.currency || 'jpy').toLowerCase();
  if (currency !== 'jpy') return 0;
  let monthly = amount * qty;
  switch (interval) {
    case 'day':   monthly = (amount * qty * 30) / intervalCount; break;
    case 'week':  monthly = (amount * qty * 4.345) / intervalCount; break;
    case 'month': monthly = (amount * qty) / intervalCount; break;
    case 'year':  monthly = (amount * qty) / (12 * intervalCount); break;
  }
  return Math.round(monthly);
}

function brandFor(productId: string | undefined, meta: Record<string, string> | undefined, prismId: string, irisId: string): Brand {
  if (productId && prismId && productId === prismId) return 'prism';
  if (productId && irisId && productId === irisId) return 'iris';
  const tag = (meta?.brand || meta?.product || '').toLowerCase();
  if (tag.includes('prism')) return 'prism';
  if (tag.includes('iris')) return 'iris';
  return 'other';
}

async function listAllSubs(secretKey: string, params: Record<string, string>): Promise<StripeSubscription[]> {
  const out: StripeSubscription[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 5; i++) {
    const sp = new URLSearchParams({ limit: '100', 'expand[]': 'data.items.data.price', ...params });
    if (startingAfter) sp.set('starting_after', startingAfter);
    const resp = await fetch(`https://api.stripe.com/v1/subscriptions?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!resp.ok) throw new Error(`Stripe subs ${resp.status}`);
    const j = await resp.json() as StripeList<StripeSubscription>;
    out.push(...j.data);
    if (!j.has_more || j.data.length === 0) break;
    startingAfter = j.data[j.data.length - 1].id;
  }
  return out;
}

async function listAllInvoices(secretKey: string, sinceUnix: number): Promise<StripeInvoice[]> {
  const out: StripeInvoice[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 10; i++) {
    const sp = new URLSearchParams({
      limit: '100',
      status: 'paid',
      'created[gte]': String(sinceUnix),
    });
    if (startingAfter) sp.set('starting_after', startingAfter);
    const resp = await fetch(`https://api.stripe.com/v1/invoices?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!resp.ok) throw new Error(`Stripe invoices ${resp.status}`);
    const j = await resp.json() as StripeList<StripeInvoice>;
    out.push(...j.data);
    if (!j.has_more || j.data.length === 0) break;
    startingAfter = j.data[j.data.length - 1].id;
  }
  return out;
}

function monthKey(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ─── ユーザー自身の事業の売上 (x-stripe-key) ───
// Stripe の balance_transactions API で全入金を取得し、月次に集計する。
// 売上 = 入金額の合計, 経費 = Stripe 手数料の合計, 利益 = 売上 - 経費。
// 全通貨対応。JPY 以外はおおよその為替で JPY 換算する。
interface StripeBalanceTxn {
  id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  created: number;
  type: string;
}

// Stripe の「最小単位 = 主単位」な通貨 (1 = そのまま、100 で割らない)
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

// おおよその為替レート (1 通貨単位 = 何円か) — 2026 年 5 月時点の概算
const FX_TO_JPY: Record<string, number> = {
  jpy: 1, usd: 156, eur: 169, gbp: 198, aud: 101, cad: 113, chf: 175,
  cny: 21.5, hkd: 20, krw: 0.11, sgd: 116, twd: 4.8, thb: 4.3,
  inr: 1.85, idr: 0.0096, myr: 33, php: 2.7, vnd: 0.0061,
  brl: 27, mxn: 9.1, nzd: 93, sek: 14.8, nok: 14.2, dkk: 22.6,
};

function toJpy(amount: number, currency: string): number {
  const c = (currency || 'jpy').toLowerCase();
  const major = ZERO_DECIMAL_CURRENCIES.has(c) ? amount : amount / 100;
  const rate = FX_TO_JPY[c] ?? 1;
  return major * rate;
}

async function listAllBalanceTxns(key: string, sinceUnix: number): Promise<StripeBalanceTxn[]> {
  const out: StripeBalanceTxn[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 20; i++) {
    const sp = new URLSearchParams({ limit: '100', 'created[gte]': String(sinceUnix) });
    if (startingAfter) sp.set('starting_after', startingAfter);
    const resp = await fetch(`https://api.stripe.com/v1/balance_transactions?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!resp.ok) throw new Error(`Stripe balance_transactions ${resp.status}`);
    const j = await resp.json() as StripeList<StripeBalanceTxn>;
    out.push(...j.data);
    if (!j.has_more || j.data.length === 0) break;
    startingAfter = j.data[j.data.length - 1].id;
  }
  return out;
}

function emptyUserMonthly() {
  return last12Months().map(m => ({ month: m, revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 }));
}

async function userRevenueSnapshot(key: string, asOf: string, ch: Record<string, string>) {
  if (!/^(rk|sk)_(live|test)_/.test(key)) {
    return json({
      asOf, mode: 'user', stripeConfigured: false,
      error: 'INVALID_KEY',
      message: 'Stripe の読み取り専用キー (rk_live_… で始まる) を貼り付けてください。',
      thisMonth: { revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 },
      monthly: emptyUserMonthly(),
      currencies: [],
    }, 400, ch);
  }

  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  try {
    const txns = await listAllBalanceTxns(key, Math.floor(since.getTime() / 1000));

    const map = new Map<string, { revenueJpy: number; expenseJpy: number; profitJpy: number; txnCount: number }>();
    for (const m of last12Months()) map.set(m, { revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 });
    const currencies = new Set<string>();

    for (const t of txns) {
      const slot = map.get(monthKey(t.created || 0));
      if (!slot) continue;
      // 口座への振替 (payout / transfer) は売上ではないので除外
      if (t.type === 'payout' || t.type === 'transfer') continue;
      const cur = (t.currency || 'jpy').toLowerCase();
      currencies.add(cur);
      const amtJpy = toJpy(t.amount || 0, cur);
      const feeJpy = toJpy(t.fee || 0, cur);
      slot.revenueJpy += amtJpy;
      slot.expenseJpy += feeJpy;
      slot.profitJpy += amtJpy - feeJpy;
      if ((t.amount || 0) > 0) slot.txnCount += 1;
    }

    const monthly = last12Months().map(m => {
      const v = map.get(m)!;
      return {
        month: m,
        revenueJpy: Math.round(v.revenueJpy),
        expenseJpy: Math.round(v.expenseJpy),
        profitJpy: Math.round(v.profitJpy),
        txnCount: v.txnCount,
      };
    });
    const tm = monthly[monthly.length - 1];

    return json({
      asOf, mode: 'user', stripeConfigured: true,
      thisMonth: {
        revenueJpy: tm.revenueJpy, expenseJpy: tm.expenseJpy,
        profitJpy: tm.profitJpy, txnCount: tm.txnCount,
      },
      monthly,
      currencies: Array.from(currencies),
    }, 200, { ...ch, 'Cache-Control': 'private, max-age=0, must-revalidate' });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const rejected = msg.includes('401') || msg.includes('403');
    return json({
      asOf, mode: 'user', stripeConfigured: false,
      error: rejected ? 'KEY_REJECTED' : 'FETCH_FAILED',
      message: rejected
        ? 'このキーでは売上を読み取れませんでした。Stripe で「すべて読み取り」権限を付けて作り直してください。'
        : 'いまは取得できませんでした。少し待ってから、更新ボタンでもう一度お試しください。',
      thisMonth: { revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 },
      monthly: emptyUserMonthly(),
      currencies: [],
    }, rejected ? 401 : 502, ch);
  }
}

function emptySnapshot(asOf: string) {
  const months = last12Months();
  return {
    asOf,
    stripeConfigured: false,
    totals: { mrrJpy: 0, paidCount: 0, arrJpy: 0, prismMrrJpy: 0, irisMrrJpy: 0, otherMrrJpy: 0 },
    byProduct: {
      prism: { mrrJpy: 0, paidCount: 0 },
      iris: { mrrJpy: 0, paidCount: 0 },
      other: { mrrJpy: 0, paidCount: 0 },
    },
    monthly: months.map(m => ({ month: m, mrrJpy: 0, prismJpy: 0, irisJpy: 0, otherJpy: 0, gmvJpy: 0 })),
  };
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, ch);

  const asOf = new Date().toISOString();

  // ユーザー自身の Stripe キーが来たら、そのユーザーの事業売上を返す
  const userKey = (req.headers.get('x-stripe-key') || '').trim();
  if (userKey) {
    return userRevenueSnapshot(userKey, asOf, ch);
  }

  // それ以外は CORE 運営の集計 (オーナー専用)
  const masterKey = req.headers.get('x-master-key') || '';
  if (masterKey !== 'GAUCHE2026') {
    return json({ error: 'FORBIDDEN', message: 'Master key required' }, 403, ch);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json({ ...emptySnapshot(asOf), error: 'STRIPE_NOT_CONFIGURED' }, 503, ch);
  }

  const prismId = process.env.STRIPE_PRODUCT_PRISM || '';
  const irisId = process.env.STRIPE_PRODUCT_IRIS || '';

  try {
    const active = await listAllSubs(secretKey, { status: 'active' });

    // 現時点 MRR をプロダクト別に集計
    const byProduct: Record<Brand, { mrrJpy: number; paidCount: number }> = {
      prism: { mrrJpy: 0, paidCount: 0 },
      iris: { mrrJpy: 0, paidCount: 0 },
      other: { mrrJpy: 0, paidCount: 0 },
    };
    for (const sub of active) {
      let subTotal = 0;
      let subBrand: Brand = 'other';
      let counted = false;
      for (const it of sub.items.data) {
        const m = monthlyAmountJpy(it);
        subTotal += m;
        if (!counted && m > 0) {
          subBrand = brandFor(it.price?.product, sub.metadata, prismId, irisId);
          counted = true;
        }
      }
      byProduct[subBrand].mrrJpy += subTotal;
      if (subTotal > 0) byProduct[subBrand].paidCount += 1;
    }

    const totals = {
      mrrJpy: byProduct.prism.mrrJpy + byProduct.iris.mrrJpy + byProduct.other.mrrJpy,
      paidCount: byProduct.prism.paidCount + byProduct.iris.paidCount + byProduct.other.paidCount,
      arrJpy: 0,
      prismMrrJpy: byProduct.prism.mrrJpy,
      irisMrrJpy: byProduct.iris.mrrJpy,
      otherMrrJpy: byProduct.other.mrrJpy,
    };
    totals.arrJpy = totals.mrrJpy * 12;

    // 月次 GMV (請求書 paid を月別に集計、過去 12 ヶ月)
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const invoices = await listAllInvoices(secretKey, Math.floor(since.getTime() / 1000));

    const monthlyMap = new Map<string, { mrrJpy: number; prismJpy: number; irisJpy: number; otherJpy: number; gmvJpy: number }>();
    // 12 ヶ月の枠を確保
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(k, { mrrJpy: 0, prismJpy: 0, irisJpy: 0, otherJpy: 0, gmvJpy: 0 });
    }

    for (const inv of invoices) {
      const created = inv.created || 0;
      if (!created) continue;
      const currency = (inv.currency || 'jpy').toLowerCase();
      if (currency !== 'jpy') continue;
      const k = monthKey(created);
      const slot = monthlyMap.get(k);
      if (!slot) continue;
      const paid = inv.amount_paid || 0;
      slot.gmvJpy += paid;
      // プロダクト割当て: line items の price.product 又は metadata
      let mainBrand: Brand = 'other';
      for (const line of inv.lines?.data || []) {
        const b = brandFor(line.price?.product, line.metadata, prismId, irisId);
        if (b !== 'other') { mainBrand = b; break; }
      }
      if (mainBrand === 'prism') slot.prismJpy += paid;
      else if (mainBrand === 'iris') slot.irisJpy += paid;
      else slot.otherJpy += paid;
      // mrrJpy ≈ 月次請求の合計 (簡易)
      slot.mrrJpy += paid;
    }

    const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v }));

    return json({
      asOf,
      stripeConfigured: true,
      productsConfigured: { prism: !!prismId, iris: !!irisId },
      totals,
      byProduct,
      monthly,
    }, 200, { ...ch, 'Cache-Control': 'private, max-age=0, must-revalidate' });
  } catch (e: any) {
    return json({ ...emptySnapshot(asOf), error: `Stripe fetch failed: ${e?.message || e}` }, 502, ch);
  }
}
