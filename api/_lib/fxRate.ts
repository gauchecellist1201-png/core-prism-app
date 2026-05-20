// ============================================================
// fxRate — 主要通貨 → 円 の為替レートを 1 日 1 回だけ無料 API から取得
// 失敗時は組み込みのフォールバックレートを使う (お金が動かない読み取り専用)
// ============================================================

// フォールバック (2026 年 5 月時点の概算 — 1 通貨単位 = 何円)
export const FALLBACK_JPY_PER_UNIT: Record<string, number> = {
  jpy: 1,
  usd: 156, eur: 169, gbp: 198, aud: 101, cad: 113, chf: 175,
  cny: 21.5, hkd: 20, krw: 0.11, sgd: 116, twd: 4.8, thb: 4.3,
  inr: 1.85, idr: 0.0096, myr: 33, php: 2.7, vnd: 0.0061,
  brl: 27, mxn: 9.1, nzd: 93, sek: 14.8, nok: 14.2, dkk: 22.6,
};

interface FxCache {
  jpyPerUnit: Record<string, number>;
  fetchedAt: number;
  source: 'api' | 'fallback';
}

const DAY_MS = 24 * 60 * 60 * 1000;
let cache: FxCache | null = null;
let inflight: Promise<FxCache> | null = null;

async function fetchFromOpenErApi(): Promise<Record<string, number> | null> {
  // 無料・APIキー不要・1 日 1 回更新で十分なエンドポイント
  // base=JPY のレートは「1 JPY = X (その通貨単位)」なので、逆数で「1 通貨単位 = (1/X) JPY」
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const resp = await fetch('https://open.er-api.com/v6/latest/JPY', { signal: ctrl.signal });
    clearTimeout(to);
    if (!resp.ok) return null;
    const json = await resp.json() as { result?: string; rates?: Record<string, number> };
    if (json.result !== 'success' || !json.rates) return null;
    const out: Record<string, number> = { jpy: 1 };
    for (const [code, perJpy] of Object.entries(json.rates)) {
      if (typeof perJpy !== 'number' || perJpy <= 0) continue;
      out[code.toLowerCase()] = 1 / perJpy;
    }
    return out;
  } catch {
    return null;
  }
}

export async function getFxRates(): Promise<FxCache> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < DAY_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const api = await fetchFromOpenErApi();
    const c: FxCache = api
      ? { jpyPerUnit: { ...FALLBACK_JPY_PER_UNIT, ...api }, fetchedAt: now, source: 'api' }
      : { jpyPerUnit: { ...FALLBACK_JPY_PER_UNIT }, fetchedAt: now, source: 'fallback' };
    cache = c;
    inflight = null;
    return c;
  })();
  return inflight;
}

/** 主要通貨 → 円 の換算レート (1 通貨単位 = 何円) を返す。APIが落ちていれば固定レートで返す */
export async function getJpyRate(currency: string): Promise<{ rate: number; source: 'api' | 'fallback' }> {
  const c = (currency || 'jpy').toLowerCase();
  const { jpyPerUnit, source } = await getFxRates();
  const rate = jpyPerUnit[c] ?? FALLBACK_JPY_PER_UNIT[c] ?? 1;
  return { rate, source };
}
