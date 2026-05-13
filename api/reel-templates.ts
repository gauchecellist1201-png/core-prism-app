// ============================================================
// /api/reel-templates — Iris Reel Studio コミュニティ型 (テンプレ) API
//
// POST: テンプレを公開 (author handle + body b64)
// GET : 最新トレンド N 件を返す
//
// Supabase が設定済なら DB に永続化、未設定ならエッジ ランタイムの in-memory
// fallback (cold-start で消えるが UX は維持)。完全無料前提。
// rate limit: 10/min per IP (簡易版)
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'https://core-prism.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

interface TemplatePayload {
  author: string;
  title: string;
  /** base64url-encoded template JSON (同形式: shareUrl のクエリ) */
  body: string;
  /** タグ (任意) */
  tags?: string[];
}

interface TemplateRecord extends TemplatePayload {
  id: string;
  uses: number;
  created_at: string;
}

// ─── in-memory fallback (cold-start で消える) ─────────
const memStore: TemplateRecord[] = [];
const ipBuckets = new Map<string, { count: number; reset: number }>();

function rateLimit(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || b.reset < now) {
    ipBuckets.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (b.count >= 10) return false;
  b.count++;
  return true;
}

// ─── Supabase REST 経由 (anon/service key) ─────────
function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function dbInsert(rec: TemplateRecord): Promise<boolean> {
  const env = supabaseEnv();
  if (!env) return false;
  try {
    const res = await fetch(`${env.url}/rest/v1/reel_templates`, {
      method: 'POST',
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rec),
    });
    return res.ok;
  } catch { return false; }
}

async function dbList(limit: number): Promise<TemplateRecord[] | null> {
  const env = supabaseEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/rest/v1/reel_templates?select=*&order=uses.desc,created_at.desc&limit=${limit}`, {
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function dbIncrementUses(id: string): Promise<void> {
  const env = supabaseEnv();
  if (!env) return;
  try {
    // 簡易: 先に現在 uses を取り、+1 で update
    const cur = await fetch(`${env.url}/rest/v1/reel_templates?id=eq.${encodeURIComponent(id)}&select=uses`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    });
    if (!cur.ok) return;
    const rows = await cur.json();
    const uses = (rows?.[0]?.uses ?? 0) + 1;
    await fetch(`${env.url}/rest/v1/reel_templates?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uses }),
    });
  } catch { /* noop */ }
}

function sanitize(p: TemplatePayload): TemplatePayload {
  return {
    author: String(p.author ?? 'anonymous').slice(0, 40).replace(/[^\w\-.@ぁ-ヿ一-龯ー]/g, ''),
    title: String(p.title ?? '無題').slice(0, 80),
    body: String(p.body ?? '').slice(0, 100_000),  // 100KB まで
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 8).map(t => String(t).slice(0, 24)) : [],
  };
}

function genId() {
  return 'tpl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export default async function handler(req: Request) {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10)));
    const use = url.searchParams.get('use');
    if (use) {
      // 使用カウンタ +1
      const idx = memStore.findIndex(t => t.id === use);
      if (idx >= 0) memStore[idx].uses++;
      await dbIncrementUses(use);
      return json({ ok: true }, 200, ch);
    }
    const dbRows = await dbList(limit);
    const rows = dbRows ?? [...memStore].sort((a, b) => b.uses - a.uses || b.created_at.localeCompare(a.created_at)).slice(0, limit);
    return json({ templates: rows }, 200, ch);
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, ch);
  if (!rateLimit(req)) return json({ error: 'rate_limited' }, 429, ch);

  let body: TemplatePayload;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_json' }, 400, ch); }
  const cleaned = sanitize(body);
  if (!cleaned.body || cleaned.body.length < 8) return json({ error: 'empty_body' }, 400, ch);

  const rec: TemplateRecord = {
    id: genId(),
    ...cleaned,
    uses: 0,
    created_at: new Date().toISOString(),
  };
  memStore.unshift(rec);
  if (memStore.length > 200) memStore.length = 200;
  await dbInsert(rec);

  return json({ ok: true, id: rec.id }, 200, ch);
}
