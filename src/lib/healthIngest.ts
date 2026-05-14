// ============================================================
// healthIngest — クライアント側ヘルパー
// iOS ショートカット連携 用の token 発行 / サーバー取得 / マージ
// ============================================================
import type { DailyHealth } from '../types/health';

const TOKEN_KEY = 'iris_health_token_v1';
const LAST_PULL_KEY = 'iris_health_last_pull_v1';

export function getHealthToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && /^irs_[a-z0-9]{12,64}$/i.test(t) ? t : null;
  } catch {
    return null;
  }
}

export function generateHealthToken(): string {
  const rnd = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rnd);
  } else {
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `irs_${hex.slice(0, 24)}`;
}

export function ensureHealthToken(): string {
  let t = getHealthToken();
  if (!t) {
    t = generateHealthToken();
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
  }
  return t;
}

export function clearHealthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LAST_PULL_KEY);
  } catch { /* ignore */ }
}

export function getLastPullAt(): number | null {
  try {
    const v = localStorage.getItem(LAST_PULL_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

interface ServerDailyMetric {
  date: string;
  source?: string;
  metrics: Record<string, number | undefined>;
  ts?: number;
}

export interface IngestPullResult {
  configured: boolean;       // サーバーが Upstash 等で永続化対応か
  daysFetched: number;       // 取得件数
  merged: DailyHealth[];     // マージ対象に渡す DailyHealth 配列
  error?: string;
}

function endpoint(): string {
  // 本番では同一オリジン /api/health/ingest を使用
  return '/api/health/ingest';
}

/** サーバー側 metrics を既存 DailyHealth 形に正規化 */
function toDaily(d: ServerDailyMetric): DailyHealth {
  const m = d.metrics || {};
  const num = (v: number | undefined, fallback = 0): number =>
    typeof v === 'number' && isFinite(v) ? v : fallback;
  // 必須プロパティをデフォルトで埋める。値が無い項目は 0 とし、欠損は UI 側で「—」表示。
  return {
    date: d.date,
    sleepHours: num(m.sleepHours),
    deepSleepMin: num(m.deepSleepMin),
    remSleepMin: num(m.remSleepMin),
    sleepScore: num(m.sleepScore, calcSleepScore(num(m.sleepHours), num(m.deepSleepMin), num(m.remSleepMin))),
    hrv: num(m.hrv),
    restingHR: num(m.restingHR ?? m.heartRate),
    recoveryScore: num(m.recoveryScore, calcRecoveryScore(num(m.hrv), num(m.restingHR ?? m.heartRate))),
    steps: num(m.steps),
    activeMinutes: num(m.activeMinutes),
    exerciseKcal: num(m.exerciseKcal),
    stressLevel: num(m.stressLevel, 50),
    mindfulMinutes: num(m.mindfulMinutes),
    hydrationL: num(m.hydrationL),
    caffeineMg: num(m.caffeineMg),
    alcoholDrinks: num(m.alcoholDrinks),
    weightKg: m.weightKg,
    bodyFatPct: m.bodyFatPct,
    bp: m.bpSys && m.bpDia ? { sys: Number(m.bpSys), dia: Number(m.bpDia) } : undefined,
    glucoseMgDl: m.glucoseMgDl,
  };
}

function calcSleepScore(hours: number, deep: number, rem: number): number {
  if (!hours) return 0;
  const base = Math.min(100, (hours / 8) * 70);
  const bonus = Math.min(30, (deep + rem) / 6);
  return Math.round(base + bonus);
}

function calcRecoveryScore(hrv: number, restingHR: number): number {
  if (!hrv && !restingHR) return 0;
  const hrvScore = hrv ? Math.min(60, hrv) : 30;
  const hrPenalty = restingHR > 65 ? (restingHR - 65) * 1.2 : 0;
  return Math.max(10, Math.min(100, Math.round(60 + (hrvScore - 40) - hrPenalty)));
}

/** サーバーから token のデータを取得 */
export async function pullIngestedDays(token: string): Promise<IngestPullResult> {
  try {
    const res = await fetch(`${endpoint()}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'X-Health-Token': token },
    });
    if (!res.ok) {
      return { configured: false, daysFetched: 0, merged: [], error: `HTTP ${res.status}` };
    }
    const j = await res.json();
    const days: ServerDailyMetric[] = Array.isArray(j?.days) ? j.days : [];
    const merged = days.map(toDaily).filter((d) => !!d.date);
    try { localStorage.setItem(LAST_PULL_KEY, String(Date.now())); } catch { /* ignore */ }
    return {
      configured: !!j?.configured,
      daysFetched: merged.length,
      merged,
    };
  } catch (e: any) {
    return { configured: false, daysFetched: 0, merged: [], error: String(e?.message || e) };
  }
}

/** テスト用に手動でデータを送る (主にデバッグ) */
export async function pushTestMetric(token: string, metrics: Record<string, number>): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Health-Token': token,
    },
    body: JSON.stringify({ source: 'iris-web-test', metrics }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** 完全な ingest 用 URL (絶対 URL — ショートカットで使用) */
export function absoluteIngestUrl(): string {
  if (typeof window === 'undefined') return endpoint();
  return `${window.location.origin}${endpoint()}`;
}
