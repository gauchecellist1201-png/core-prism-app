// ============================================================
// /api/master/secrets-health — オーナー専用 env 健康診断
//
// オーナー指示 (2026-06-04 第 14 波 FFF)
//
// GET (x-master-key: GAUCHE2026 必須)
//   → 各 env の有無 + 疎通テスト結果を JSON 返却
// ============================================================

export const config = { runtime: 'edge' };

import { runSecretsHealth } from '../_lib/secretsHealth';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const url = new URL(req.url);
  const key = req.headers.get('x-master-key') || url.searchParams.get('master_key') || '';
  if (key !== 'GAUCHE2026') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const data = await runSecretsHealth();
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
