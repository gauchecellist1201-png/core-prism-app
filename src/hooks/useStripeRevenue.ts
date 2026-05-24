// ============================================================
// useStripeRevenue — ユーザー自身の Stripe (rk_live_…) から
//                    今月/月次の売上・経費・利益を取得する共通フック
//
// 設計の根っこ:
//   オーナー指摘 (2026-05-25):
//     「PRISM ダッシュボードに 300 万円の売上が反映されてない」
//     → MyBusinessRevenueCard は Stripe を叩いていたが、その値が
//        メインの『今月の収支』(persona.cashflow.income) や
//        今日のブリーフに連動していなかった。
//   このフックで一元化し、どのコンポーネントも同じ実数値を見られるように。
//
// 使い方:
//   const { thisMonth, monthly, connected, loading } = useStripeRevenue();
//   if (thisMonth.revenueJpy > 0) /* Stripe からの実値 */
// ============================================================
import { useEffect, useState, useCallback } from 'react';

const STRIPE_KEY_LS = 'core_integration_stripe';
const CACHE_LS = 'core_stripe_revenue_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分

export interface MonthRevenuePoint {
  month: string;       // 'YYYY-MM'
  revenueJpy: number;
  expenseJpy: number;
  profitJpy: number;
  txnCount: number;
}

export interface StripeRevenue {
  thisMonth: { revenueJpy: number; expenseJpy: number; profitJpy: number; txnCount: number };
  monthly: MonthRevenuePoint[];
  currencies: string[];
  fxSource?: string;
  fetchedAt: number;
}

interface Cache {
  key: string;       // Stripe key の先頭 8 文字 (照合用)
  fetchedAt: number;
  data: StripeRevenue;
}

function readKey(): string {
  try {
    const v = localStorage.getItem(STRIPE_KEY_LS) || '';
    return /^(rk|sk)_(live|test)_/.test(v) ? v : '';
  } catch { return ''; }
}

function readCache(currentKey: string): StripeRevenue | null {
  try {
    const raw = localStorage.getItem(CACHE_LS);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (c.key !== currentKey.slice(0, 8)) return null;
    if (Date.now() - c.fetchedAt > CACHE_TTL_MS) return null;
    return c.data;
  } catch { return null; }
}

function writeCache(key: string, data: StripeRevenue) {
  try {
    const c: Cache = { key: key.slice(0, 8), fetchedAt: Date.now(), data };
    localStorage.setItem(CACHE_LS, JSON.stringify(c));
  } catch { /* quota */ }
}

export function useStripeRevenue() {
  const [key, setKey] = useState<string>(() => readKey());
  const [data, setData] = useState<StripeRevenue | null>(() => {
    const k = readKey();
    return k ? readCache(k) : null;
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchNow = useCallback(async (k: string, force = false) => {
    if (!k) return;
    if (!force) {
      const cached = readCache(k);
      if (cached) {
        setData(cached);
        return;
      }
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/revenue/snapshot', { headers: { 'x-stripe-key': k } });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('API 未デプロイ');
      const j = await r.json();
      if (j.error) {
        setErr(j.message || j.error);
        setData(null);
        return;
      }
      const next: StripeRevenue = {
        thisMonth: j.thisMonth || { revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 },
        monthly: Array.isArray(j.monthly) ? j.monthly : [],
        currencies: Array.isArray(j.currencies) ? j.currencies : [],
        fxSource: j.fxSource,
        fetchedAt: Date.now(),
      };
      setData(next);
      writeCache(k, next);
    } catch (e: any) {
      setErr(e?.message || '取得失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const k = readKey();
    setKey(k);
    if (k) fetchNow(k, false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STRIPE_KEY_LS) {
        const nk = readKey();
        setKey(nk);
        if (nk) fetchNow(nk, true); else setData(null);
      }
    };
    const onConn = () => {
      const nk = readKey();
      setKey(nk);
      if (nk) fetchNow(nk, true); else setData(null);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('core:stripe-connected', onConn);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('core:stripe-connected', onConn);
    };
  }, [fetchNow]);

  return {
    connected: !!key,
    keyMasked: key ? `${key.slice(0, 8)}…` : '',
    thisMonth: data?.thisMonth || { revenueJpy: 0, expenseJpy: 0, profitJpy: 0, txnCount: 0 },
    monthly: data?.monthly || [],
    currencies: data?.currencies || [],
    loading,
    error: err,
    refresh: () => key && fetchNow(key, true),
    /** 直近 N ヶ月の合計 */
    sumMonths: (n: number) => {
      const ms = (data?.monthly || []).slice(-n);
      return {
        revenueJpy: ms.reduce((s, m) => s + m.revenueJpy, 0),
        expenseJpy: ms.reduce((s, m) => s + m.expenseJpy, 0),
        profitJpy: ms.reduce((s, m) => s + m.profitJpy, 0),
        txnCount: ms.reduce((s, m) => s + (m.txnCount || 0), 0),
      };
    },
    /** 前月比 (今月 - 先月) / 先月 */
    momGrowth: (() => {
      const ms = data?.monthly || [];
      if (ms.length < 2) return null;
      const cur = ms[ms.length - 1].revenueJpy;
      const prev = ms[ms.length - 2].revenueJpy;
      if (prev === 0) return null;
      return (cur - prev) / prev;
    })(),
  };
}
