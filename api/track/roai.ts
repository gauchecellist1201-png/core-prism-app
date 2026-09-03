// ============================================================
// /api/track/roai — /corp と CORE ROAI SCORE の導線ビーコン受信
//
// POST { event: string, label?: string }
// GET  ?days=14&master_key=…  — 直近 N 日の生カウント（オーナー用）
//
// Upstash 永続化（未設定なら console.log のみ）
//   key:   roai:funnel:<YYYY-MM-DD>
//   field: <event> と <event>:<label>（合計と内訳を別に足す）
// 個人情報は受け取らない（label は英数字 40 文字に丸める）。
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
const MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || 'GAUCHE2026';

// src/corporate/roai/track.ts の ROAI_EVENTS と揃える
export const ROAI_EVENTS = [
  'corp_page_view', 'corp_cta_click',
  'roai_view', 'roai_start', 'roai_step', 'roai_back', 'roai_resume', 'roai_complete',
  'roai_result_view', 'roai_basis_open', 'roai_report_request', 'roai_consult_click', 'roai_consult_submit', 'roai_restart',
] as const;
const EVENT_SET = new Set<string>(ROAI_EVENTS);

export function sanitizeLabel(raw: unknown): string {
  return String(raw ?? '').slice(0, 40).replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/^_+|_+$/g, '');
}

async function up(cmd: (string | number)[]): Promise<unknown> {
  if (!UPSTASH_OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(UP_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function dateOffsetDays(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
    if (key !== MASTER_KEY) return json({ error: 'forbidden' }, 403);
    const days = Math.max(1, Math.min(60, Number(url.searchParams.get('days') || '14')));
    if (!UPSTASH_OK) return json({ ok: true, configured: false, days: [] });
    const list: Array<{ date: string; counts: Record<string, number> }> = [];
    for (let i = 0; i < days; i++) {
      const d = dateOffsetDays(i);
      try {
        const r = await up(['HGETALL', `roai:funnel:${d}`]);
        const arr: string[] = (r as { result?: string[] }).result || [];
        const counts: Record<string, number> = {};
        for (let j = 0; j < arr.length; j += 2) counts[arr[j]] = Number(arr[j + 1]) || 0;
        list.push({ date: d, counts });
      } catch { list.push({ date: d, counts: {} }); }
    }
    return json({ ok: true, configured: true, days: list.reverse() });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  let body: { event?: string; label?: string };
  try { body = await req.json(); } catch { body = {}; }
  const event = String(body.event || '');
  if (!EVENT_SET.has(event)) return json({ ok: false, error: 'invalid_event' }, 400);
  const label = sanitizeLabel(body.label);

  if (UPSTASH_OK) {
    try {
      const key = `roai:funnel:${new Date().toISOString().slice(0, 10)}`;
      await up(['HINCRBY', key, event, 1]);
      if (label) await up(['HINCRBY', key, `${event}:${label}`, 1]);
      await up(['EXPIRE', key, 400 * 86400]);
    } catch (e) {
      console.error('[roai-funnel] upstash error', (e as Error).message);
    }
  } else {
    console.log(`[roai-funnel] ${event}${label ? `:${label}` : ''}`);
  }
  return json({ ok: true });
}
