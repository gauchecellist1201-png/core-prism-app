// ============================================================
// POST /api/instagram/profile-by-token
//
// Cookie ベース OAuth ではなく、ユーザーが developers.facebook.com で
// 取得した Personal Access Token を直接ヘッダで受け取り、
// IG Graph API を叩いてフルプロフィールを正規化して返す。
//
// Meta App Review 前でも advanced ユーザーが「自分のトークン貼り付け」で
// 即座に実データ取込できるようにする緊急対応エンドポイント。
//
// Headers:
//   x-ig-token:       IG Access Token (long-lived 推奨)
//   x-ig-account-id:  IG Business Account ID (連携している FB ページに紐付くもの)
//                     省略時は /me?fields=accounts から自動推定
// ============================================================

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://core-prism-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5181',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const o = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ig-token, x-ig-account-id',
    'Access-Control-Max-Age': '86400',
  };
}

interface IgUser {
  id?: string;
  username?: string;
  name?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

interface IgMediaItem {
  id: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
  caption?: string;
  media_type?: string;
}

interface IgInsight {
  name: string;
  total_value?: { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };
}

async function resolveAccountId(token: string): Promise<string | null> {
  // ユーザーが FB ページ ID を知らなくても、/me/accounts → instagram_business_account で取れる
  try {
    const u = new URL('https://graph.facebook.com/v21.0/me/accounts');
    u.searchParams.set('fields', 'instagram_business_account');
    u.searchParams.set('access_token', token);
    const r = await fetch(u.toString());
    if (!r.ok) return null;
    const j = await r.json() as { data?: Array<{ instagram_business_account?: { id?: string } }> };
    for (const p of j.data || []) {
      if (p.instagram_business_account?.id) return p.instagram_business_account.id;
    }
    return null;
  } catch { return null; }
}

export default async function handler(req: Request): Promise<Response> {
  const ch = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...ch },
    });
  }

  const token = (req.headers.get('x-ig-token') || '').trim();
  let accountId = (req.headers.get('x-ig-account-id') || '').trim();

  if (!token) {
    return new Response(JSON.stringify({
      error: 'missing_token',
      message: 'アクセストークン (x-ig-token) を貼り付けてください',
      recovery: 'https://developers.facebook.com/tools/explorer/ で User Access Token を発行 → "instagram_basic / instagram_manage_insights / pages_show_list" 権限を付けてください',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
  }

  if (!accountId) {
    const auto = await resolveAccountId(token);
    if (!auto) {
      return new Response(JSON.stringify({
        error: 'no_business_account',
        message: 'このトークンに紐づく Instagram Business Account が見つかりませんでした',
        recovery: 'Instagram を Business / Creator アカウントに切替え、Facebook ページと紐付けてからお試しください (Personal アカウントでは IG Graph API は使えません)',
      }), { status: 400, headers: { 'Content-Type': 'application/json', ...ch } });
    }
    accountId = auto;
  }

  try {
    // 基本プロフィール
    const profUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}`);
    profUrl.searchParams.set('fields', 'id,username,name,followers_count,media_count,profile_picture_url');
    profUrl.searchParams.set('access_token', token);
    const profResp = await fetch(profUrl.toString());
    if (!profResp.ok) {
      const t = await profResp.text();
      return new Response(JSON.stringify({
        error: 'graph_failed',
        status: profResp.status,
        detail: t,
        message: 'Meta Graph API の呼出しに失敗しました',
        recovery: profResp.status === 401
          ? 'トークンが期限切れ / 権限不足です。https://developers.facebook.com/tools/explorer/ で新しい long-lived token を発行し直してください。'
          : 'Account ID とトークンの組合せを確認してください。',
      }), { status: 502, headers: { 'Content-Type': 'application/json', ...ch } });
    }
    const user = (await profResp.json()) as IgUser;

    // 直近 25 件メディアでエンゲージメント平均
    const mediaUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}/media`);
    mediaUrl.searchParams.set('fields', 'id,like_count,comments_count,timestamp,caption,media_type');
    mediaUrl.searchParams.set('limit', '25');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResp = await fetch(mediaUrl.toString());
    const mediaJson = (await mediaResp.json()) as { data?: IgMediaItem[] };
    const media = mediaJson.data || [];
    const totalLikes = media.reduce((s, m) => s + (m.like_count || 0), 0);
    const totalComments = media.reduce((s, m) => s + (m.comments_count || 0), 0);
    const avgLikes = media.length ? Math.round(totalLikes / media.length) : 0;
    const avgComments = media.length ? Math.round(totalComments / media.length) : 0;

    // 最適投稿時間
    const slotStats = new Map<string, { likes: number; n: number }>();
    const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'];
    for (const m of media) {
      if (!m.timestamp) continue;
      const d = new Date(m.timestamp);
      const key = `${weekdayJa[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:00`;
      const cur = slotStats.get(key) || { likes: 0, n: 0 };
      cur.likes += m.like_count || 0;
      cur.n += 1;
      slotStats.set(key, cur);
    }
    let bestPostTime = '土 21:00';
    let bestAvg = -1;
    for (const [k, v] of slotStats) {
      const avg = v.n ? v.likes / v.n : 0;
      if (avg > bestAvg) { bestAvg = avg; bestPostTime = k; }
    }

    // リールと通常投稿の比率
    const reelCount = media.filter(m => m.media_type === 'REELS' || m.media_type === 'VIDEO').length;
    const imageCount = media.length - reelCount;

    // オーディエンス insights — 必要権限が無い / フォロワー <100 の場合は静かに 0 件
    let audienceAge: { range: string; pct: number }[] = [];
    let audienceGender = { female: 0, male: 0, other: 0 };
    let audienceTopCountries: { country: string; pct: number }[] = [];
    try {
      const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}/insights`);
      insightsUrl.searchParams.set('metric', 'follower_demographics');
      insightsUrl.searchParams.set('period', 'lifetime');
      insightsUrl.searchParams.set('breakdown', 'age,gender,country');
      insightsUrl.searchParams.set('metric_type', 'total_value');
      insightsUrl.searchParams.set('access_token', token);
      const insResp = await fetch(insightsUrl.toString());
      if (insResp.ok) {
        const insJson = await insResp.json() as { data?: IgInsight[] };
        const buckets = insJson.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        const ageMap = new Map<string, number>();
        const genderMap = new Map<string, number>();
        const countryMap = new Map<string, number>();
        for (const r of buckets) {
          const [age, gender, country] = r.dimension_values;
          ageMap.set(age, (ageMap.get(age) || 0) + r.value);
          genderMap.set(gender, (genderMap.get(gender) || 0) + r.value);
          countryMap.set(country, (countryMap.get(country) || 0) + r.value);
        }
        const total = Array.from(ageMap.values()).reduce((s, n) => s + n, 0) || 1;
        audienceAge = Array.from(ageMap.entries())
          .map(([range, n]) => ({ range, pct: Math.round((n / total) * 100) }))
          .sort((a, b) => b.pct - a.pct);
        const g = (k: string) => Math.round(((genderMap.get(k) || 0) / total) * 100);
        audienceGender = { female: g('F'), male: g('M'), other: g('U') };
        audienceTopCountries = Array.from(countryMap.entries())
          .map(([country, n]) => ({ country, pct: Math.round((n / total) * 100) }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 5);
      }
    } catch { /* */ }

    const followers = user.followers_count || 0;
    const saveRate = followers > 0 ? Math.min(8, Math.max(0.5, (avgLikes / followers) * 100 * 0.4)) : 0;

    const profile = {
      handle: user.username || '',
      followers,
      avgLikes,
      avgComments,
      topPostCategories: [],
      bestPostTime,
      saveRate: Number(saveRate.toFixed(1)),
      storyViewRate: 0,
      audienceAge,
      audienceGender,
      audienceTopCountries,
      reelRatio: media.length ? Math.round((reelCount / media.length) * 100) : 0,
      imageRatio: media.length ? Math.round((imageCount / media.length) * 100) : 0,
      mediaCount: user.media_count || media.length,
      source: 'oauth' as const,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      raw: {
        id: user.id, name: user.name,
        avatarUrl: user.profile_picture_url,
        accountId,
      },
    };

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...ch },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      error: 'fetch_failed', detail: e?.message || String(e),
      message: '取得に失敗しました。少し待ってからもう一度お試しください。',
    }), { status: 500, headers: { 'Content-Type': 'application/json', ...ch } });
  }
}
