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

export interface ServerDailyMetric {
  date: string;
  source?: string;
  appleHealthReceived?: boolean;
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
export function toDailyHealth(d: ServerDailyMetric): DailyHealth | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
  const m = d.metrics || {};
  const num = (v: number | undefined, fallback = 0): number =>
    typeof v === 'number' && isFinite(v) ? v : fallback;
  // 必須プロパティをデフォルトで埋める。値が無い項目は 0 とし、欠損は UI 側で「—」表示。
  return {
    date: d.date,
    source: typeof d.source === 'string' && d.source.trim() ? d.source.trim() : undefined,
    appleHealthReceived: d.appleHealthReceived === true || isAppleHealthSyncSource(d.source),
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
    // Apple Health が送っていない指標を「50」と見せない。0 は UI 側で欠損表示になる。
    stressLevel: num(m.stressLevel),
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

export function normalizeIngestedDays(days: unknown): DailyHealth[] {
  if (!Array.isArray(days)) return [];
  return days
    .map((day) => {
      if (!day || typeof day !== 'object') return null;
      return toDailyHealth(day as ServerDailyMetric);
    })
    .filter((day): day is DailyHealth => day !== null);
}

/** Apple Health / Watch の自動同期から来た実データだけを識別する。 */
export function isAppleHealthSyncSource(source: unknown): boolean {
  if (typeof source !== 'string') return false;
  return ['ios-shortcut', 'apple-health', 'apple-watch', 'healthkit'].includes(source.trim().toLowerCase());
}

export type AppleHealthSyncState =
  | { kind: 'not-connected' }
  | { kind: 'current'; latestDate: string; daysBehind: 0 | 1 }
  | { kind: 'stale'; latestDate: string; daysBehind: number };

function utcDayNumber(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Apple Health 由来の最新日だけを使って、毎朝同期が止まっていないか判定する。
 * 前日分までは正常（朝の自動実行前を誤警告しない）、2日以上空いた時だけ stale。
 * 手入力や Bluetooth の新しい記録で、止まった Apple Health 同期を隠さない。
 */
export function getAppleHealthSyncState(
  days: Array<Pick<ServerDailyMetric, 'date' | 'source' | 'appleHealthReceived'>>,
  currentDate: string,
): AppleHealthSyncState {
  const currentDay = utcDayNumber(currentDate);
  if (currentDay === null) return { kind: 'not-connected' };

  const latest = days
    .filter((day) => {
      const dayNumber = utcDayNumber(day.date);
      return (day.appleHealthReceived === true || isAppleHealthSyncSource(day.source))
        && dayNumber !== null
        // 翌日までの端末時刻ずれは許容するが、遠い未来日の破損値は同期証拠にしない。
        && dayNumber <= currentDay + 1;
    })
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return { kind: 'not-connected' };

  const latestDay = utcDayNumber(latest.date)!;
  const daysBehind = currentDay - latestDay;
  // 端末時刻のずれ等で未来日が来た場合は、途切れたとは断定しない。
  if (daysBehind <= 0) return { kind: 'current', latestDate: latest.date, daysBehind: 0 };
  if (daysBehind === 1) return { kind: 'current', latestDate: latest.date, daysBehind: 1 };
  return { kind: 'stale', latestDate: latest.date, daysBehind };
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
    const merged = normalizeIngestedDays(days);
    try { localStorage.setItem(LAST_PULL_KEY, String(Date.now())); } catch { /* ignore */ }
    return {
      configured: !!j?.configured,
      daysFetched: merged.length,
      merged,
    };
  } catch (e: unknown) {
    return {
      configured: false,
      daysFetched: 0,
      merged: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** テスト用に手動でデータを送る (主にデバッグ) */
export async function pushTestMetric(token: string, metrics: Record<string, number>): Promise<{
  ok: boolean;
  status: number;
  body: { configured?: boolean; accepted?: number; [key: string]: unknown };
}> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Health-Token': token,
    },
    body: JSON.stringify({ source: 'iris-web-test', metrics }),
  });
  const body = await res.json().catch(() => ({})) as { configured?: boolean; accepted?: number; [key: string]: unknown };
  return { ok: res.ok, status: res.status, body };
}

/** 完全な ingest 用 URL (絶対 URL — ショートカットで使用) */
export function absoluteIngestUrl(): string {
  if (typeof window === 'undefined') return endpoint();
  return `${window.location.origin}${endpoint()}`;
}
