// ============================================================
// GET /api/instagram/insights
//
// 直近 30 日のメディアインサイト (reach / saved / engagement) を
// 集計して返す。各メディアにつき per-media insights を取得し
// 合計・平均・トップ投稿を出す。
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

interface MediaItem {
  id: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface InsightResp {
  data?: { name: string; values?: { value: number }[] }[];
}

const METRICS_FEED = ['reach', 'saved', 'likes', 'comments', 'shares'];
const METRICS_REEL = ['reach', 'saved', 'likes', 'comments', 'shares', 'plays'];

async function fetchMediaInsights(
  accountToken: string,
  mediaId: string,
  mediaType: string,
): Promise<Record<string, number>> {
  const metrics = (mediaType || '').toUpperCase() === 'REELS' ? METRICS_REEL : METRICS_FEED;
  const u = new URL(`https://graph.facebook.com/v21.0/${mediaId}/insights`);
  u.searchParams.set('metric', metrics.join(','));
  u.searchParams.set('access_token', accountToken);
  const resp = await fetch(u.toString());
  if (!resp.ok) return {};
  const j = (await resp.json()) as InsightResp;
  const out: Record<string, number> = {};
  for (const row of j.data || []) {
    const v = row.values?.[0]?.value;
    if (typeof v === 'number') out[row.name] = v;
  }
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const cookies = readCookies(req);
  const token = cookies['ig_access_token'];
  const accountId = cookies['ig_account_id'];
  if (!token || !accountId) {
    return new Response(JSON.stringify({ error: 'not_connected' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  try {
    // 直近メディア取得 (最大 50 件、cutoff で打ち切り)
    const mediaUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}/media`);
    mediaUrl.searchParams.set(
      'fields',
      'id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count',
    );
    mediaUrl.searchParams.set('limit', '50');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResp = await fetch(mediaUrl.toString());
    if (!mediaResp.ok) {
      const t = await mediaResp.text();
      return new Response(JSON.stringify({ error: 'graph_failed', detail: t }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const mediaJson = (await mediaResp.json()) as { data?: MediaItem[] };
    const recent = (mediaJson.data || []).filter((m) => {
      if (!m.timestamp) return false;
      return new Date(m.timestamp).getTime() >= cutoff;
    });

    // 各メディアの insights を並列取得 (最大 20 件まで API 節約)
    const targets = recent.slice(0, 20);
    const enriched = await Promise.all(
      targets.map(async (m) => ({
        ...m,
        insights: await fetchMediaInsights(token, m.id, m.media_type || ''),
      })),
    );

    const sum = (key: string) =>
      enriched.reduce((s, m) => s + (m.insights[key] || 0), 0);
    const totalReach = sum('reach');
    const totalSaved = sum('saved');
    const totalLikes = sum('likes') || enriched.reduce((s, m) => s + (m.like_count || 0), 0);
    const totalComments = sum('comments') || enriched.reduce((s, m) => s + (m.comments_count || 0), 0);
    const totalShares = sum('shares');
    const totalPlays = sum('plays');
    const totalEngagement = totalLikes + totalComments + totalSaved + totalShares;

    const top = [...enriched]
      .sort((a, b) => (b.insights.reach || 0) - (a.insights.reach || 0))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        permalink: m.permalink,
        caption: (m.caption || '').slice(0, 120),
        mediaType: m.media_type,
        timestamp: m.timestamp,
        likes: m.like_count || m.insights.likes || 0,
        comments: m.comments_count || m.insights.comments || 0,
        reach: m.insights.reach || 0,
        saved: m.insights.saved || 0,
      }));

    const result = {
      period: { from: new Date(cutoff).toISOString(), to: new Date().toISOString() },
      counts: {
        mediaTotal: recent.length,
        mediaAnalyzed: enriched.length,
      },
      totals: {
        reach: totalReach,
        saved: totalSaved,
        likes: totalLikes,
        comments: totalComments,
        shares: totalShares,
        plays: totalPlays,
        engagement: totalEngagement,
      },
      averages: {
        reachPerPost: enriched.length ? Math.round(totalReach / enriched.length) : 0,
        savedPerPost: enriched.length ? Math.round(totalSaved / enriched.length) : 0,
        engagementPerPost: enriched.length ? Math.round(totalEngagement / enriched.length) : 0,
      },
      topPosts: top,
      updatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    console.error('[ig insights] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
