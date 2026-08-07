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
const MANUAL_LS = 'core_manual_revenue_v1'; // EasyImportPanel の手動入力 (オーナー指示 2026-05-26)

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
  /** API 側の診断情報 (どの権限が通ったか) */
  diag?: {
    triedCharges?: boolean;
    chargesOk?: boolean;
    chargesCount?: number;
    triedBalanceTxns?: boolean;
    balanceTxnsOk?: boolean;
    balanceTxnsCount?: number;
    errors?: string[];
  };
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

/** デモ体験用の擬似キー (rk_test_demo_… )。本物のキーはこの形にならない。 */
function isDemoKey(k: string): boolean {
  return /^(rk|sk)_test_demo_/.test(k);
}

interface ManualRevenue {
  thisMonthRevenueJpy: number;
  thisMonthExpenseJpy: number;
  pipelineDealCount: number;
  enteredAt: string;
}

function readManualRevenue(): ManualRevenue | null {
  try {
    const raw = localStorage.getItem(MANUAL_LS);
    if (!raw) return null;
    return JSON.parse(raw) as ManualRevenue;
  } catch { return null; }
}

/** 手動入力データから StripeRevenue 形に変換 (今月分のみ反映、月次推移は空) */
function manualToStripeRevenue(m: ManualRevenue): StripeRevenue {
  const profit = m.thisMonthRevenueJpy - m.thisMonthExpenseJpy;
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    thisMonth: {
      revenueJpy: m.thisMonthRevenueJpy,
      expenseJpy: m.thisMonthExpenseJpy,
      profitJpy: profit,
      txnCount: 0,
    },
    monthly: [{
      month: thisMonthKey,
      revenueJpy: m.thisMonthRevenueJpy,
      expenseJpy: m.thisMonthExpenseJpy,
      profitJpy: profit,
      txnCount: 0,
    }],
    currencies: ['jpy'],
    fxSource: 'manual:user-entry',
    fetchedAt: new Date(m.enteredAt).getTime(),
  };
}

function readCache(currentKey: string): StripeRevenue | null {
  try {
    const raw = localStorage.getItem(CACHE_LS);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (c.key !== currentKey.slice(0, 8)) return null;
    // デモ体験の数字は seed した中身がすべて (取りに行く先が無い)。
    // 5 分で期限切れにすると、体験の途中で売上が消えて「—」になる。
    const demo = isDemoKey(currentKey);
    if (!demo && Date.now() - c.fetchedAt > CACHE_TTL_MS) return null;
    // 旧コード (2026-05-26 修正前) のキャッシュは diag 未保存。
    // それを返すと「0 件」が永続化されるので破棄して再取得を促す。
    // ただし demo の seed も diag を持たないので、demo は対象外。
    if (!demo && !c.data.diag) return null;
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
  const [manual, setManual] = useState<ManualRevenue | null>(() => readManualRevenue());
  const [data, setData] = useState<StripeRevenue | null>(() => {
    const k = readKey();
    if (k) {
      const cached = readCache(k);
      if (cached) return cached;
    }
    // Stripe 鍵が無く manual 入力があれば、それを使う
    const m = readManualRevenue();
    return m ? manualToStripeRevenue(m) : null;
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchNow = useCallback(async (k: string, force = false) => {
    if (!k) return;
    // ★デモ体験中は本物の Stripe へ出ない (2026-08-08 本番実測で発見)
    //   擬似キー rk_test_demo_… で /api/revenue/snapshot を叩くと必ず失敗し、
    //   「登録せずに、中を見る」で入った人の最初の画面が
    //     ・今月稼いだ → 「—」「まだ今月の取引はありません」
    //     ・赤いカードで「このキーでは売上を読み取れませんでした。Stripe で
    //       Charges 権限を『読み取り』にして作り直してください」
    //   になっていた。デモの人は Stripe の鍵など持っていないので、自分では
    //   絶対に直せないエラーを、体験の一番最初に見せていたことになる。
    //   seed 済みのキャッシュをそのまま使い、通信そのものをしない。
    if (isDemoKey(k)) {
      setData(readCache(k));
      setErr(null);
      setLoading(false);
      return;
    }
    if (!force) {
      const cached = readCache(k);
      if (cached) {
        setData(cached);
        return;
      }
    } else {
      // 強制更新時はキャッシュも消す (古い 0 件レスポンスが永続化されるのを防ぐ。
      // オーナー報告 2026-05-26: 再取得を押しても何も変わらない問題の修正)
      try { localStorage.removeItem(CACHE_LS); } catch { /* */ }
    }
    setLoading(true);
    setErr(null);
    try {
      // ?_bust= で CDN / ブラウザの全キャッシュをバイパス
      const r = await fetch('/api/revenue/snapshot?_bust=' + Date.now(), { headers: { 'x-stripe-key': k } });
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
        diag: j.diag,
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

    const refreshAll = () => {
      const nk = readKey();
      const nm = readManualRevenue();
      setKey(nk);
      setManual(nm);
      if (nk) {
        fetchNow(nk, true);
      } else if (nm) {
        setData(manualToStripeRevenue(nm));
      } else {
        setData(null);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STRIPE_KEY_LS || e.key === MANUAL_LS) refreshAll();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('core:stripe-connected', refreshAll);
    window.addEventListener('core:manual-revenue-updated', refreshAll);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('core:stripe-connected', refreshAll);
      window.removeEventListener('core:manual-revenue-updated', refreshAll);
    };
  }, [fetchNow]);

  return {
    /** Stripe 連携済み OR 手動入力あり */
    connected: !!key || !!manual,
    /** 取り込み元: 'stripe' (real API) / 'manual' (手動) / null */
    source: (key ? 'stripe' : manual ? 'manual' : null) as 'stripe' | 'manual' | null,
    keyMasked: key ? `${key.slice(0, 8)}…` : manual ? '手動入力' : '',
    /** /api/revenue/snapshot が返した診断情報 (どの権限が通ったか) */
    diag: data?.diag,
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
