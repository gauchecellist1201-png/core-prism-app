// ============================================================
// retentionTracker.ts — DAU + 7 日以内再訪問率の計測
//
// オーナー指示 (2026-06-03 第 10 波 RR):
//   App マウント時に「今日アクティブだった」というシグナルを Upstash に送る。
//   匿名 UUID をデバイスに 1 つ持たせる (個人特定はしない)。
//
// 動作:
//   1) 端末 UUID を localStorage に永続 (初回生成)
//   2) /api/track/retention に POST (deviceId, lastVisitDate を含む)
//   3) サーバ側で:
//       - active:<YYYY-MM-DD> set に deviceId を SADD
//       - 7d:<YYYY-MM-DD>:<deviceId> EXPIRE 7d (TTL ベースで自然消滅)
//       → 7 日以内再訪問率 = 「昨日アクティブ かつ 7d:<昨日>:<id> が現存」
//
//   ※ 個人情報は送らない。deviceId は完全ランダムで他端末と紐付かない。
// ============================================================

const DEVICE_KEY = 'core_device_id_v1';
const LAST_PING_KEY = 'core_retention_last_ping_v1';
const BEACON_PATH = '/api/track/retention';

function genUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as Crypto).randomUUID();
  } catch { /* */ }
  // 簡易フォールバック (crypto API がない環境)
  const arr = new Uint8Array(16);
  try { crypto.getRandomValues(arr); } catch { for (let i = 0; i < arr.length; i++) arr[i] = i; }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id && id.length > 8) return id;
    id = genUuid();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return genUuid();
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * App マウント時に 1 日 1 回だけ ping を送る。
 * 同じ日に複数回マウントしても重複送信しない (sessionStorage で抑制)。
 */
export function pingRetention(): void {
  if (typeof window === 'undefined') return;
  const today = todayKey();
  try {
    const last = localStorage.getItem(LAST_PING_KEY);
    if (last === today) return;
  } catch { /* */ }

  const id = getDeviceId();
  const payload = JSON.stringify({ deviceId: id, date: today });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(BEACON_PATH, blob);
    } else {
      fetch(BEACON_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* */ });
    }
  } catch { /* */ }

  try { localStorage.setItem(LAST_PING_KEY, today); } catch { /* */ }
}

/** master ダッシュ用 (デバッグ表示) */
export function getCurrentDeviceId(): string | null {
  try { return localStorage.getItem(DEVICE_KEY); } catch { return null; }
}
