// ============================================================
// GET /api/instagram/media
//
// OAuth 連携済み (cookie ig_access_token) の Instagram 本人の
// 直近メディアを、各投稿のインサイト (reach / saved) 付きで返す。
// 「伸ばす作戦 / 伸びパターン」を実データで埋めるために使う。
//
// 2026-09-08 追記 — 「最後まで見られたか」の実数:
//   リール(動画)にだけ平均視聴時間 (ig_reels_avg_watch_time) を足す。
//   ★指標名とメディア種別の対応は Instagram 側の都合で変わりうるので、
//     reach/saved とは **別のリクエスト** に分けてある。
//     視聴時間の方が落ちても reach/saved は巻き添えにならない
//     (同じ metric に足すと、リクエストごと 400 になって既存の 2 指標まで消える)。
//   取れなかった投稿には何も返さない (0 秒も「—」も返さない = 0 は嘘になる)。
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

/** 動画として平均視聴時間を聞きにいく media_type (それ以外には聞かない) */
const VIDEO_MEDIA_TYPES = new Set(['VIDEO', 'REEL', 'REELS']);

/**
 * 1 投稿ぶんの insights を取り、name -> value の対応で返す。
 * 失敗 (権限なし / 指標名が使えない / 通信エラー) は **空** を返すだけで投げない。
 * 呼び出し側は指標ごとに別々に呼ぶので、片方が落ちても他方は残る。
 */
async function readInsights(mediaId: string, metric: string, token: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const url = new URL(`https://graph.instagram.com/v21.0/${mediaId}/insights`);
    url.searchParams.set('metric', metric);
    url.searchParams.set('access_token', token);
    const resp = await fetch(url.toString());
    if (!resp.ok) return out;
    const json = (await resp.json()) as { data?: IgInsight[] };
    for (const it of json.data || []) {
      const v = it.values?.[0]?.value;
      if (it.name && typeof v === 'number' && Number.isFinite(v)) out[it.name] = v;
    }
  } catch { /* この指標は省略 (他の指標は生かす) */ }
  return out;
}

/**
 * ig_reels_avg_watch_time は **ミリ秒**。秒 (小数第1位) に直す。
 * 0 以下・数値でないものは undefined = 「無かったこと」にする
 * (0 秒と言い切ると嘘になる。何も出さないのが正しい)。
 */
function msToSeconds(ms: number | undefined): number | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.round((ms / 1000) * 10) / 10;
}

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
      const mediaType = m.media_type || 'IMAGE';
      const base = await readInsights(m.id, 'reach,saved', token);
      // 動画 (リール) にだけ、別リクエストで平均視聴時間を聞く。
      // 画像/カルーセルには存在しない指標なので、聞くと 400 になる = 聞かない。
      const watch = VIDEO_MEDIA_TYPES.has(mediaType.toUpperCase())
        ? await readInsights(m.id, 'ig_reels_avg_watch_time', token)
        : {};
      return {
        id: m.id,
        caption: m.caption || '',
        mediaType,
        permalink: m.permalink || '',
        thumbnailUrl: m.thumbnail_url || m.media_url || '',
        timestamp: m.timestamp || '',
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        reach: base.reach,
        saved: base.saved,
        avgWatchSeconds: msToSeconds(watch.ig_reels_avg_watch_time),
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
