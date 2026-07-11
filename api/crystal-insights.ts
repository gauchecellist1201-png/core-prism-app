// ============================================================
// /api/crystal-insights — Crystal 会話インサイト (Upstash 集計)
//
// Crystal コンシェルジュ (/crystal, /concierge, 埋め込み) の実会話から
// 「よく聞かれた質問」「答えに詰まった質問」「会話数」を集計する。
// 個人情報は保存しない — 保存するのは質問文 (120文字まで) と件数のみ。
//
// POST { site, question, answered, first }
//   → 質問を集計に加算。first=true なら当日の会話数も +1
// GET  ?site=...
//   → { ok, configured, conversations7d, topQuestions, missedQuestions }
//
// Upstash keys (TTL 30日):
//   crystal:conv:<site>:<YYYY-MM-DD>  (String)    — 日別の会話数
//   crystal:q:<site>                  (SortedSet) — 質問ごとの回数
//   crystal:miss:<site>               (SortedSet) — 答えに詰まった質問の回数
// ============================================================

export const config = { runtime: 'edge' };

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const OK = !!(UP_URL && UP_TOK);

const TTL_SEC = 30 * 24 * 60 * 60; // 30日で自動掃除 (プライバシー配慮)

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

/** パイプライン (複数コマンドを1往復で) */
async function upPipeline(cmds: (string | number)[][]): Promise<any[]> {
  if (!OK) throw new Error('UPSTASH_NOT_CONFIGURED');
  const res = await fetch(`${UP_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
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
      'Cache-Control': 'no-store',
    },
  });
}

/** site id は英数とハイフン/アンダースコアのみ (キーインジェクション防止) */
function sanitizeSite(v: unknown): string | null {
  const s = String(v || '').trim().toLowerCase();
  return /^[a-z0-9_-]{4,40}$/.test(s) ? s : null;
}

function dayKey(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // UTC の日付で統一
}

function parseZrange(res: any): Array<{ text: string; count: number }> {
  const arr = res?.result;
  if (!Array.isArray(arr)) return [];
  const out: Array<{ text: string; count: number }> = [];
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const n = Number(arr[i + 1]);
    if (Number.isFinite(n) && n > 0) out.push({ text: String(arr[i]), count: n });
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    } });
  }

  // ── 記録 (ウィジェットから fire-and-forget) ──────────
  if (req.method === 'POST') {
    if (!OK) return json({ ok: false, error: 'not_configured' }, 503);
    let body: { site?: unknown; question?: unknown; answered?: unknown; first?: unknown };
    try { body = await req.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
    const site = sanitizeSite(body.site);
    if (!site) return json({ ok: false, error: 'bad_site' }, 400);
    const question = typeof body.question === 'string' ? body.question.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    if (!question) return json({ ok: false, error: 'bad_question' }, 400);
    const answered = body.answered !== false;
    const first = body.first === true;

    const qKey = `crystal:q:${site}`;
    const missKey = `crystal:miss:${site}`;
    const cmds: (string | number)[][] = [
      ['ZINCRBY', qKey, 1, question],
      ['EXPIRE', qKey, TTL_SEC],
    ];
    if (!answered) {
      cmds.push(['ZINCRBY', missKey, 1, question], ['EXPIRE', missKey, TTL_SEC]);
    }
    if (first) {
      const cKey = `crystal:conv:${site}:${dayKey()}`;
      cmds.push(['INCR', cKey], ['EXPIRE', cKey, TTL_SEC]);
    }
    try {
      await upPipeline(cmds);
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  }

  // ── 集計の読み出し (オーナーのインサイト画面) ──────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const site = sanitizeSite(url.searchParams.get('site'));
    if (!site) return json({ ok: false, error: 'bad_site' }, 400);
    if (!OK) return json({ ok: true, configured: false, conversations7d: 0, topQuestions: [], missedQuestions: [] });
    try {
      const convKeys = Array.from({ length: 7 }, (_, i) => `crystal:conv:${site}:${dayKey(i)}`);
      const results = await upPipeline([
        ['MGET', ...convKeys],
        ['ZREVRANGE', `crystal:q:${site}`, 0, 7, 'WITHSCORES'],
        ['ZREVRANGE', `crystal:miss:${site}`, 0, 7, 'WITHSCORES'],
      ]);
      const convArr = (results?.[0]?.result || []) as Array<string | null>;
      const conversations7d = convArr.reduce((sum: number, v) => sum + (Number(v) || 0), 0);
      return json({
        ok: true,
        configured: true,
        conversations7d,
        topQuestions: parseZrange(results?.[1]),
        missedQuestions: parseZrange(results?.[2]),
        asOf: new Date().toISOString(),
      });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message }, 500);
    }
  }

  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
