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
    'Access-Control-Allow-Headers': 'Content-Type, x-master-key',
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

function emptySnapshot(asOf: string) {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
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

  const masterKey = req.headers.get('x-master-key') || '';
  if (masterKey !== 'GAUCHE2026') {
    return json({ error: 'FORBIDDEN', message: 'Master key required' }, 403, ch);
  }

  const asOf = new Date().toISOString();
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
