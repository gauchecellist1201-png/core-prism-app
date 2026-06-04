// ============================================================
// /api/master/audit-log — オーナー専用 認証 履歴 (master:audit:list)
//
// オーナー指示 (2026-06-04 第 40 波 DDDDDD)
//
// GET (x-master-key: GAUCHE2026)
//   → { entries: AuditEntry[] } 新しい順
// ============================================================

export const config = { runtime: 'edge' };

import { logMasterAudit, readMasterAudit } from '../_lib/masterAudit';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') {
    await logMasterAudit(req, '/api/master/audit-log', 'forbidden');
    return json({ error: 'forbidden' }, 403);
  }
  await logMasterAudit(req, '/api/master/audit-log', 'ok');
  const entries = await readMasterAudit();
  return json({ ok: true, asOf: new Date().toISOString(), count: entries.length, entries: entries.slice(0, 500) });
}
