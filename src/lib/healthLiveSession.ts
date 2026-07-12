// ============================================================
// healthLiveSession — Web Bluetooth のライブ計測を PHR に保存する
//
// LiveHRPanel で測った 1 セッション (安静時心拍・HRV・消費エネルギー) を
// 既存の /api/health/ingest に POST し、ダッシュボード / AI 健康アドバイスへ
// 反映する。Apple Watch のショートカット連携と同じ受け口・同じ本人識別を使う。
//
// 本人識別 (どちらか):
//   - hash: ログイン email の SHA-256 (Prism / 経営者・医療事業者向け)
//   - token: irs_ 形式 (Iris 系)
// ============================================================
import { fetchWithTimeout } from './fetchWithTimeout';
import type { HRSessionSummary } from './webBluetoothHR';

export type HealthIdentity =
  | { kind: 'hash'; id: string }
  | { kind: 'token'; id: string };

export interface SaveResult {
  ok: boolean;
  persisted: boolean;   // サーバーが実際に永続化したか (Upstash 設定済みか)
  message: string;      // ユーザーに見せるやさしい文言
}

/** email から本人識別ハッシュを計算 (ショートカット連携と同一方式) */
export async function emailToHash(email: string): Promise<string> {
  const enc = new TextEncoder().encode(email.trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function authHeader(ident: HealthIdentity): Record<string, string> {
  return ident.kind === 'token'
    ? { 'X-Health-Token': ident.id }
    : { 'X-User-Email-Hash': ident.id };
}

/**
 * ライブ計測セッションの要約を今日分として保存する。
 * - restingBpm → restingHR / avgBpm → heartRate / hrvRmssd → hrv
 * - energyKj(0.239kcal/kj) → exerciseKcal (>0 のときのみ)
 * 弱電波でも固まらないよう fetchWithTimeout(15秒)。失敗は例外にせず SaveResult で返す。
 */
export async function saveLiveHRSession(
  ident: HealthIdentity,
  summary: HRSessionSummary,
): Promise<SaveResult> {
  const metrics: Record<string, number> = {
    restingHR: summary.restingBpm,
    heartRate: summary.avgBpm,
  };
  if (summary.hrvRmssd > 0) metrics.hrv = summary.hrvRmssd;
  if (summary.energyKj > 0) metrics.exerciseKcal = Math.round(summary.energyKj * 0.239);

  try {
    const res = await fetchWithTimeout('/api/health/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(ident) },
      body: JSON.stringify({ date: todayLocal(), source: 'web-bluetooth', metrics }),
    }, 15000);
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) {
      return { ok: false, persisted: false, message: body?.hint || `保存に失敗しました (${res.status})。もう一度お試しください。` };
    }
    const persisted = body?.persisted === true || body?.configured === true;
    return {
      ok: true,
      persisted,
      message: persisted
        ? '計測を保存しました。ダッシュボードの「今日のカラダ」に反映されます。'
        : '計測を受け取りました。永続保存にはサーバーの保存設定(Upstash)が必要です。',
    };
  } catch {
    return { ok: false, persisted: false, message: '通信が不安定なようです。電波の良い場所でもう一度お試しください。' };
  }
}

/**
 * 本人識別に紐づくデータが実際にサーバーへ届いているか確認する (接続確認ループ用)。
 * ショートカット設定後に「ちゃんと受信できたか」を可視化するために使う。
 */
export interface IngestStatus {
  configured: boolean;   // サーバーが永続化対応か
  count: number;         // 保存されている日数
  latestDate?: string;   // 最新の日付
  latest?: Record<string, number>; // 最新日のメトリクス (心拍・歩数など)
}

export async function checkIngestStatus(ident: HealthIdentity): Promise<IngestStatus | null> {
  try {
    const res = await fetchWithTimeout(
      `/api/health/ingest?${ident.kind === 'token' ? 'token' : 'hash'}=${encodeURIComponent(ident.id)}`,
      { method: 'GET', headers: authHeader(ident) },
      12000,
    );
    if (!res.ok) return null;
    const j = await res.json();
    const days: Array<{ date: string; metrics?: Record<string, number> }> = Array.isArray(j?.days) ? j.days : [];
    const latest = days.length ? days[days.length - 1] : undefined;
    return {
      configured: !!j?.configured,
      count: days.length,
      latestDate: latest?.date,
      latest: latest?.metrics,
    };
  } catch {
    return null;
  }
}
