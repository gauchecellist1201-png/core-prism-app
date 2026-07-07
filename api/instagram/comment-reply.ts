// ============================================================
// POST /api/instagram/comment-reply
//
// OAuth 連携済み (cookie ig_access_token) のアカウントとして
// 指定コメントに返信を実送信する。
// 必要スコープ: instagram_business_manage_comments (取得済み)
// body: { commentId: string, message: string }
// ============================================================

export const config = { runtime: 'edge' };

function readCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const token = readCookies(req)['ig_access_token'];
  if (!token) {
    return new Response(JSON.stringify({ error: 'not_connected' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  let body: { commentId?: string; message?: string } = {};
  try {
    body = await req.json();
  } catch { /* invalid json → 下で弾く */ }

  const commentId = (body.commentId || '').trim();
  const message = (body.message || '').trim();
  if (!commentId || !message) {
    return new Response(JSON.stringify({ error: 'bad_request', detail: 'commentId と message は必須です' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  if (message.length > 2000) {
    return new Response(JSON.stringify({ error: 'bad_request', detail: '返信は 2000 文字以内にしてください' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const url = new URL(`https://graph.instagram.com/v21.0/${encodeURIComponent(commentId)}/replies`);
    const params = new URLSearchParams();
    params.set('message', message);
    params.set('access_token', token);

    const resp = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(JSON.stringify({ error: 'graph_failed', detail }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const json = (await resp.json()) as { id?: string };
    return new Response(JSON.stringify({ ok: true, replyId: json.id || '' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[ig comment-reply] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
