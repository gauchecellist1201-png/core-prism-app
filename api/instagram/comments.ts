// ============================================================
// GET /api/instagram/comments
//
// OAuth 連携済み (cookie ig_access_token) の Instagram 本人の
// 直近メディアに付いたコメント一覧を返す。
// 返信センター (Iris) が「未返信コメント」を洗い出すために使う。
// 自分のユーザー名も返し、replies に自分が含まれるかで
// 「返信済み」をサーバー側で判定して repliedByMe を付ける。
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

interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  comments_count?: number;
}

interface IgReply { id: string; username?: string }

interface IgComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  replies?: { data?: IgReply[] };
}

export default async function handler(req: Request): Promise<Response> {
  const token = readCookies(req)['ig_access_token'];
  if (!token) {
    return new Response(JSON.stringify({ error: 'not_connected' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    // 自分のユーザー名 (返信済み判定に使う)
    let myUsername = '';
    try {
      const meUrl = new URL('https://graph.instagram.com/v21.0/me');
      meUrl.searchParams.set('fields', 'username');
      meUrl.searchParams.set('access_token', token);
      const meResp = await fetch(meUrl.toString());
      if (meResp.ok) {
        const meJson = (await meResp.json()) as { username?: string };
        myUsername = meJson.username || '';
      }
    } catch { /* username 取得失敗でも一覧は返す */ }

    // 直近メディア (最大 12 件)
    const mediaUrl = new URL('https://graph.instagram.com/v21.0/me/media');
    mediaUrl.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count',
    );
    mediaUrl.searchParams.set('limit', '12');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResp = await fetch(mediaUrl.toString());
    if (!mediaResp.ok) {
      const detail = await mediaResp.text();
      return new Response(JSON.stringify({ error: 'graph_failed', detail }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    const mediaJson = (await mediaResp.json()) as { data?: IgMedia[] };
    const media = (mediaJson.data || []);

    // 各メディアのコメントを並列取得 (コメント 0 件の投稿はスキップ)
    const items = await Promise.all(media.map(async (m) => {
      let comments: IgComment[] = [];
      if ((m.comments_count || 0) > 0) {
        try {
          const cUrl = new URL(`https://graph.instagram.com/v21.0/${m.id}/comments`);
          cUrl.searchParams.set('fields', 'id,text,username,timestamp,like_count,replies{id,username}');
          cUrl.searchParams.set('limit', '25');
          cUrl.searchParams.set('access_token', token);
          const cResp = await fetch(cUrl.toString());
          if (cResp.ok) {
            const cJson = (await cResp.json()) as { data?: IgComment[] };
            comments = cJson.data || [];
          }
        } catch { /* この投稿のコメントは省略 */ }
      }
      return {
        mediaId: m.id,
        caption: m.caption || '',
        mediaType: m.media_type || 'IMAGE',
        permalink: m.permalink || '',
        thumbnailUrl: m.thumbnail_url || m.media_url || '',
        timestamp: m.timestamp || '',
        comments: comments
          // 自分自身のコメントは「返信対象」ではないので除外
          .filter((c) => !myUsername || c.username !== myUsername)
          .map((c) => ({
            id: c.id,
            text: c.text || '',
            username: c.username || '',
            timestamp: c.timestamp || '',
            likeCount: c.like_count || 0,
            repliedByMe: !!myUsername
              && (c.replies?.data || []).some((r) => r.username === myUsername),
          })),
      };
    }));

    return new Response(JSON.stringify({
      username: myUsername,
      items: items.filter((it) => it.comments.length > 0),
      checkedMediaCount: media.length,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[ig comments] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
