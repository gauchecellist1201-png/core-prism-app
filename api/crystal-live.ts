// ============================================================
// /api/crystal-live — Crystal ライブ連携 (外部システムの「今」を取り込む)
//
// Anima (アニメ制作進行OS) などの外部システムが発行する読み取り専用の
// ステータスURLを、お店ごと(site)にサーバー側で保存し、会話のたびに
// サーバーが代理取得して要約テキストだけを返す。
// 連携URL(トークン入り)はクライアントの共有URL(?c=)には決して載らない。
//
// GET    ?site=...              → { ok, configured, text?, fetchedAt?, sourceHost? }
// POST   { site, url }          → 連携URLを保存 (https のみ)
// POST   { site, action:'disconnect' } → 連携解除
//
// Upstash key: crystal:live:<site> (String, TTL 365日) — { url, savedAt }
// ============================================================
export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);
const TTL_SEC = 365 * 24 * 60 * 60;
const SITE_RE = /^c[a-f0-9]{16}$/i;
const MAX_TEXT = 3800;

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });
}

const key = (site: string) => `crystal:live:${site}`;

// SSRF ガード: https のみ・内部アドレス/リテラルIPは拒否
function urlAllowed(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.toLowerCase();
  if (
    h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')
  ) return null;
  return u;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return json({ ok: true });

  try {
    if (req.method === 'GET') {
      const site = new URL(req.url).searchParams.get('site') || '';
      if (!SITE_RE.test(site)) return json({ ok: false, error: 'site が不正です' }, 400);
      const got = await up(['GET', key(site)]);
      if (!got?.result) return json({ ok: true, configured: false });
      let saved: { url?: string } = {};
      try { saved = JSON.parse(got.result); } catch {}
      const u = saved.url ? urlAllowed(saved.url) : null;
      if (!u) return json({ ok: true, configured: false });

      // 保存済みURLをサーバーが代理取得 (6秒タイムアウト)
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      let text = '';
      try {
        const res = await fetch(u.toString(), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) return json({ ok: true, configured: true, error: `連携先の応答: HTTP ${res.status}` });
        const raw = await res.text();
        try {
          const data = JSON.parse(raw);
          text = String(data.summary_text || data.summary || data.text || raw);
        } catch {
          text = raw;
        }
      } catch {
        return json({ ok: true, configured: true, error: '連携先に接続できませんでした' });
      } finally {
        clearTimeout(timer);
      }
      return json({
        ok: true,
        configured: true,
        text: text.slice(0, MAX_TEXT),
        fetchedAt: new Date().toISOString(),
        sourceHost: u.hostname,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({} as any));
      const site = String(body.site || '');
      if (!SITE_RE.test(site)) return json({ ok: false, error: 'site が不正です' }, 400);

      if (body.action === 'disconnect') {
        await up(['DEL', key(site)]);
        return json({ ok: true });
      }

      const u = urlAllowed(String(body.url || ''));
      if (!u) return json({ ok: false, error: 'https:// で始まる公開URLを指定してください' }, 400);
      await up(['SET', key(site), JSON.stringify({ url: u.toString(), savedAt: new Date().toISOString() }), 'EX', TTL_SEC]);
      return json({ ok: true });
    }

    return json({ ok: false, error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ ok: false, error: 'サーバーエラーが発生しました。時間をおいて再試行してください。' }, 500);
  }
}
