// ============================================================
// GET /api/resonance/summary  (Node.js ランタイム)
//
// Resonance (別アプリ) の集約 API を、サーバー側で共有キー付きで叩いて
// Prism のクライアントへ中継する (キーをクライアントに晒さない)。
// 注: Edge ランタイムだと外部 Vercel への fetch がハングするため Node。
// env: RESONANCE_BASE_URL, CORE_AGGREGATE_KEY
// ============================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const base = process.env.RESONANCE_BASE_URL || 'https://resonancebot-ivory.vercel.app';
  const key = process.env.CORE_AGGREGATE_KEY || '';
  res.setHeader('Cache-Control', 'no-store');

  if (!key) return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'CORE_AGGREGATE_KEY 未設定' });

  try {
    const r = await fetch(`${base}/api/aggregate`, {
      headers: { 'x-core-key': key },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return res.status(502).json({ error: 'RESONANCE_UNAVAILABLE', status: r.status });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(503).json({ error: 'RESONANCE_UNAVAILABLE', message: 'Resonance に接続できませんでした', detail: String(e?.name || '') + ': ' + String(e?.message || e).slice(0, 200) });
  }
}
