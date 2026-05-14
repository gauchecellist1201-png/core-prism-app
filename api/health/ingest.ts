// ============================================================
// /api/health/ingest — Apple Health 自動連携エンドポイント
//
// iOS ショートカット が HealthKit データを毎日 POST する受け口。
// Iris の Web アプリは GET でデータを取得し、ローカルにマージする。
//
// 認証: X-Health-Token (ユーザー固有、Iris の設定画面で発行)
// 永続化: Upstash Redis REST (UPSTASH_REDIS_REST_URL/TOKEN が設定されていれば)
//         未設定時は 202 Accepted + persisted:false を返し、運用者に env 設定を促す
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'https://iris.gauche.tokyo',
  'https://core-prism.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Health-Token, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

// ---- Token --------------------------------------------------
// 形式: irs_<base36 length 16..64>
const TOKEN_RE = /^irs_[a-z0-9]{12,64}$/i;

function validToken(t: string | null | undefined): t is string {
  return !!t && TOKEN_RE.test(t);
}

function tokenKey(token: string): string {
  return `iris:health:${token}`;
}

// ---- Upstash REST -------------------------------------------
const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_CONFIGURED = !!(UP_URL && UP_TOK);

async function upstash(cmd: (string | number)[]): Promise<any> {
  if (!UPSTASH_CONFIGURED) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UP_TOK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`upstash ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// 直近 60 日分の DailyHealth を JSON で保存
async function storeDays(token: string, days: DailyMetric[]): Promise<number> {
  const key = tokenKey(token);
  // 既存読み込み → マージ → 60 日に切り詰め
  let existing: DailyMetric[] = [];
  try {
    const r = await upstash(['GET', key]);
    if (r?.result) existing = JSON.parse(r.result);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  const map = new Map<string, DailyMetric>();
  for (const d of existing) if (d?.date) map.set(d.date, d);
  for (const d of days) {
    if (!d?.date) continue;
    const prev = map.get(d.date);
    map.set(d.date, prev ? { ...prev, ...d, metrics: { ...prev.metrics, ...d.metrics } } : d);
  }
  const merged = [...map.values()]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);
  // TTL 180 日
  await upstash(['SET', key, JSON.stringify(merged), 'EX', 60 * 60 * 24 * 180]);
  return merged.length;
}

async function loadDays(token: string): Promise<DailyMetric[]> {
  try {
    const r = await upstash(['GET', tokenKey(token)]);
    if (!r?.result) return [];
    const parsed = JSON.parse(r.result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---- Types --------------------------------------------------
interface MetricBag {
  steps?: number;
  restingHR?: number;
  heartRate?: number;
  hrv?: number;
  sleepHours?: number;
  deepSleepMin?: number;
  remSleepMin?: number;
  activeMinutes?: number;
  exerciseKcal?: number;
  weightKg?: number;
  bodyFatPct?: number;
  mindfulMinutes?: number;
  hydrationL?: number;
  caffeineMg?: number;
  bpSys?: number;
  bpDia?: number;
  glucoseMgDl?: number;
  [k: string]: number | undefined;
}

interface DailyMetric {
  date: string;          // YYYY-MM-DD (ローカル日)
  source?: string;       // "ios-shortcut" など
  metrics: MetricBag;
  ts?: number;           // 取得時刻 (ms)
}

interface IngestBody {
  date?: string;
  metrics?: MetricBag;
  days?: DailyMetric[];
  source?: string;
  // ショートカット個別フィールド (date + metrics の代替形式)
  steps?: number;
  restingHR?: number;
  hrv?: number;
  sleepHours?: number;
  activeMinutes?: number;
}

function clampNum(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n)) return undefined;
  if (n < lo || n > hi) return undefined;
  return n;
}

function sanitizeMetrics(raw: MetricBag | undefined): MetricBag {
  if (!raw || typeof raw !== 'object') return {};
  const out: MetricBag = {};
  const map: Array<[keyof MetricBag, number, number]> = [
    ['steps', 0, 200000],
    ['restingHR', 20, 200],
    ['heartRate', 20, 250],
    ['hrv', 1, 400],
    ['sleepHours', 0, 24],
    ['deepSleepMin', 0, 24 * 60],
    ['remSleepMin', 0, 24 * 60],
    ['activeMinutes', 0, 1440],
    ['exerciseKcal', 0, 10000],
    ['weightKg', 20, 300],
    ['bodyFatPct', 1, 70],
    ['mindfulMinutes', 0, 600],
    ['hydrationL', 0, 20],
    ['caffeineMg', 0, 2000],
    ['bpSys', 50, 260],
    ['bpDia', 30, 200],
    ['glucoseMgDl', 20, 1000],
  ];
  for (const [k, lo, hi] of map) {
    const v = clampNum(raw[k], lo, hi);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeBody(body: IngestBody): DailyMetric[] {
  const out: DailyMetric[] = [];
  const src = body.source || 'ios-shortcut';

  if (Array.isArray(body.days)) {
    for (const d of body.days) {
      if (!d || typeof d !== 'object') continue;
      const date = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : today();
      const m = sanitizeMetrics(d.metrics);
      if (Object.keys(m).length === 0) continue;
      out.push({ date, source: d.source || src, metrics: m, ts: Date.now() });
    }
    return out;
  }

  // 単一日: { date, metrics: {...} } または { date, steps, sleepHours, ... } のフラット形式
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : today();
  const flat: MetricBag = {
    steps: body.steps,
    restingHR: body.restingHR,
    hrv: body.hrv,
    sleepHours: body.sleepHours,
    activeMinutes: body.activeMinutes,
  };
  const combined = { ...flat, ...(body.metrics || {}) };
  const m = sanitizeMetrics(combined);
  if (Object.keys(m).length > 0) {
    out.push({ date, source: src, metrics: m, ts: Date.now() });
  }
  return out;
}

// ---- Handler ------------------------------------------------
export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

  const url = new URL(req.url);

  // GET: token に紐づく最近のデータを返す
  if (req.method === 'GET') {
    const token = req.headers.get('x-health-token') || url.searchParams.get('token');
    if (!validToken(token)) {
      return json({ ok: false, error: 'invalid_token' }, 401, ch);
    }
    if (!UPSTASH_CONFIGURED) {
      return json({ ok: true, configured: false, days: [], hint: 'UPSTASH_REDIS_REST_URL/TOKEN 未設定。env を追加すると永続化されます。' }, 200, ch);
    }
    const days = await loadDays(token);
    return json({ ok: true, configured: true, days, count: days.length }, 200, ch);
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, ch);
  }

  // 認証
  const token = req.headers.get('x-health-token') || url.searchParams.get('token');
  if (!validToken(token)) {
    return json({ ok: false, error: 'invalid_token', hint: 'X-Health-Token に irs_xxxxxxxxxxxx 形式を指定してください' }, 401, ch);
  }

  // body 解析
  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400, ch);
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'bad_body' }, 400, ch);
  }

  const days = normalizeBody(body);
  if (days.length === 0) {
    return json({ ok: false, error: 'no_metrics', hint: '少なくとも 1 つのメトリクス (steps / restingHR / sleepHours など) を含めてください' }, 422, ch);
  }

  // 永続化
  if (!UPSTASH_CONFIGURED) {
    // 受領はするが永続化しない (運用者向け案内)
    return json({
      ok: true,
      persisted: false,
      configured: false,
      accepted: days.length,
      hint: 'UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN を Vercel env に設定してください (Upstash 無料枠 OK)',
      echo: days,
    }, 202, ch);
  }

  try {
    const total = await storeDays(token, days);
    return json({ ok: true, persisted: true, configured: true, accepted: days.length, totalDays: total }, 200, ch);
  } catch (e: any) {
    return json({ ok: false, error: 'store_failed', detail: String(e?.message || e).slice(0, 200) }, 500, ch);
  }
}
