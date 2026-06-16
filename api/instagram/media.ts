// ============================================================
// GET /api/instagram/media
//
// OAuth 連携済み (cookie ig_access_token) の Instagram 本人の
// 直近メディアを、各投稿のインサイト (reach / saved) 付きで返す。
// 「伸ばす作戦 / 伸びパターン」を実データで埋めるために使う。
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
  media_type?: string;       // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface IgInsight { name: string; values?: { value: number }[] }

export default async function handler(req: Request): Promise<Response> {
  const token = readCookies(req)['ig_access_token'];
  if (!token) {
    return new Response(JSON.stringify({ error: 'not_connected' }), {
      status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  try {
    // 直近メディア (最大 24 件)
    const mediaUrl = new URL('https://graph.instagram.com/v21.0/me/media');
    mediaUrl.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    );
    mediaUrl.searchParams.set('limit', '24');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResp = await fetch(mediaUrl.toString());
    if (!mediaResp.ok) {
      const detail = await mediaResp.text();
      return new Response(JSON.stringify({ error: 'graph_failed', detail }), {
        status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    const mediaJson = (await mediaResp.json()) as { data?: IgMedia[] };
    const media = mediaJson.data || [];

    // 各メディアの reach / saved を並列取得 (取れないものはスキップ)
    const withInsights = await Promise.all(media.map(async (m) => {
      let reach: number | undefined;
      let saved: number | undefined;
      try {
        const insUrl = new URL(`https://graph.instagram.com/v21.0/${m.id}/insights`);
        insUrl.searchParams.set('metric', 'reach,saved');
        insUrl.searchParams.set('access_token', token);
        const insResp = await fetch(insUrl.toString());
        if (insResp.ok) {
          const insJson = (await insResp.json()) as { data?: IgInsight[] };
          for (const it of insJson.data || []) {
            const v = it.values?.[0]?.value;
            if (it.name === 'reach' && typeof v === 'number') reach = v;
            if (it.name === 'saved' && typeof v === 'number') saved = v;
          }
        }
      } catch { /* この投稿の insights は省略 */ }
      return {
        id: m.id,
        caption: m.caption || '',
        mediaType: m.media_type || 'IMAGE',
        permalink: m.permalink || '',
        thumbnailUrl: m.thumbnail_url || m.media_url || '',
        timestamp: m.timestamp || '',
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        reach,
        saved,
      };
    }));

    return new Response(JSON.stringify({ media: withInsights }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[ig media] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
