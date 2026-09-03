// ============================================================
// /api/roai/leads — CORE ROAI SCORE のリード一覧（オーナー専用）
// GET ?master_key=…&limit=50   x-master-key ヘッダでも可
//
// Sales Intelligence の最初の一段。ここを CRM / Nexus へ流すときは、
// この endpoint を読む側を足す（書き込み側 api/roai/lead.ts は変えない）。
// ============================================================
import type { LeadRecord } from './lead';

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const UPSTASH_OK = !!(UP_URL && UP_TOK);
const MASTER_KEY = (typeof process !== 'undefined' && process.env?.MASTER_KEY) || 'GAUCHE2026';

async function up(cmd: (string | number)[]): Promise<{ result?: unknown }> {
  const res = await fetch(UP_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return res.json();
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== MASTER_KEY) return json({ error: 'forbidden' }, 403);
  if (!UPSTASH_OK) return json({ ok: true, configured: false, leads: [] });
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '50')));
  try {
    const ids = ((await up(['LRANGE', 'roai:leads', 0, limit - 1])).result as string[]) || [];
    const leads: LeadRecord[] = [];
    for (const id of ids) {
      const raw = (await up(['GET', `roai:lead:${id}`])).result;
      if (typeof raw === 'string') { try { leads.push(JSON.parse(raw)); } catch { /* */ } }
    }
    const tiers = { HOT: 0, WARM: 0, NURTURE: 0 } as Record<string, number>;
    for (const l of leads) tiers[l.result.tier] = (tiers[l.result.tier] || 0) + 1;
    return json({ ok: true, configured: true, count: leads.length, tiers, leads });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
