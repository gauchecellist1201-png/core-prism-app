// ============================================================
// masterAudit.ts — オーナー専用 認証 履歴 ロガー
//
// オーナー指示 (2026-06-04 第 40 波 DDDDDD):
//   master key で 認証された 操作 を Upstash に rolling 1000 件 で 保存。
//   /master/audit-log で 時系列に確認。
//
// 保存 key: master:audit:list (List, JSON 文字列)
// rolling : 1000 件 (LTRIM)
// TTL     : なし (持続)
//
// PII 配慮:
//   - IP は 先頭 / 末尾だけ 残し 中央 マスク
//   - UA は 主要トークン (Mac/Win/iOS/Android + Chrome/Safari/Firefox) だけ抽出
//   - master_key の値 は 一切 記録しない (auth=ok / forbidden だけ)
// ============================================================

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);
const KEY = 'master:audit:list';
const MAX = 1000;

async function up(cmd: (string | number)[]): Promise<any> {
  if (!OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function maskIp(ip: string): string {
  if (!ip) return '—';
  // IPv4: 1.2.3.4 → 1.x.x.4 / IPv6: 短くまとめ
  const v4 = ip.match(/^(\d+)\.\d+\.\d+\.(\d+)$/);
  if (v4) return `${v4[1]}.x.x.${v4[2]}`;
  // IPv6 はもう少し雑に: 先頭 group + ... + 末尾 group
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    if (parts.length > 1) return `${parts[0]}:…:${parts[parts.length - 1]}`;
  }
  return ip.length > 12 ? ip.slice(0, 4) + '…' + ip.slice(-4) : ip;
}

function summarizeUa(ua: string): string {
  if (!ua) return '—';
  const os = /iPhone|iPad/i.test(ua) ? 'iOS'
    : /Android/i.test(ua) ? 'Android'
    : /Mac OS X/i.test(ua) ? 'macOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const br = /Edg\//i.test(ua) ? 'Edge'
    : /CriOS|Chrome/i.test(ua) ? 'Chrome'
    : /FxiOS|Firefox/i.test(ua) ? 'Firefox'
    : /Safari/i.test(ua) ? 'Safari' : 'Other';
  return `${os} · ${br}`;
}

export interface AuditEntry {
  ts: number;            // epoch ms
  endpoint: string;      // '/api/master/secrets-health'
  action: string;        // 'GET' | 'POST' など (任意)
  authResult: 'ok' | 'forbidden';
  ipMasked: string;
  uaShort: string;
  note?: string;
}

/** master endpoint から 呼ぶ — 失敗は黙って無視 (audit が APIを止めない) */
export async function logMasterAudit(req: Request, endpoint: string, authResult: 'ok' | 'forbidden', note?: string): Promise<void> {
  if (!OK) return;
  try {
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0]?.trim() || '';
    const ua = req.headers.get('user-agent') || '';
    const entry: AuditEntry = {
      ts: Date.now(),
      endpoint,
      action: req.method || 'GET',
      authResult,
      ipMasked: maskIp(ip),
      uaShort: summarizeUa(ua),
      note,
    };
    await up(['RPUSH', KEY, JSON.stringify(entry)]);
    await up(['LTRIM', KEY, -MAX, -1]);
  } catch {
    /* 黙って無視 */
  }
}

/** /api/master/audit-log の GET で 使う */
export async function readMasterAudit(): Promise<AuditEntry[]> {
  if (!OK) return [];
  try {
    const r = await up(['LRANGE', KEY, 0, -1]);
    const arr = ((r as { result?: string[] }).result || []) as string[];
    return arr.map((s) => { try { return JSON.parse(s) as AuditEntry; } catch { return null as any; } }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}
