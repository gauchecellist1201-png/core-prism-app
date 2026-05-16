// ============================================================
// GET /api/instagram/profile
//
// HttpOnly Cookie (ig_access_token, ig_account_id) を読み、
// Instagram Graph API から IG プロフィールを取得して正規化。
// クライアントの IgProfile 形に近い JSON を返す。
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
}

interface IgInsightValue { value: number | Record<string, number> }
interface IgInsight {
  name: string;
  values?: IgInsightValue[];
  total_value?: { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };
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

  try {
    // 基本プロフィール
    const profUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}`);
    profUrl.searchParams.set(
      'fields',
      'id,username,name,followers_count,media_count,profile_picture_url',
    );
    profUrl.searchParams.set('access_token', token);
    const profResp = await fetch(profUrl.toString());
    if (!profResp.ok) {
      const t = await profResp.text();
      return new Response(JSON.stringify({ error: 'graph_failed', detail: t }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const user = (await profResp.json()) as IgUser;

    // 直近 25 件メディアでエンゲージメント平均
    const mediaUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}/media`);
    mediaUrl.searchParams.set('fields', 'id,like_count,comments_count,timestamp,caption');
    mediaUrl.searchParams.set('limit', '25');
    mediaUrl.searchParams.set('access_token', token);
    const mediaResp = await fetch(mediaUrl.toString());
    const mediaJson = (await mediaResp.json()) as { data?: IgMediaItem[] };
    const media = mediaJson.data || [];
    const totalLikes = media.reduce((s, m) => s + (m.like_count || 0), 0);
    const totalComments = media.reduce((s, m) => s + (m.comments_count || 0), 0);
    const avgLikes = media.length ? Math.round(totalLikes / media.length) : 0;
    const avgComments = media.length ? Math.round(totalComments / media.length) : 0;

    // 最適投稿時間 (曜日×時間で平均いいねが最大の枠)
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

    // オーディエンス insights (国・年齢・性別) — IG Graph 制約: フォロワー 100 未満では取得不可
    let audienceAge: { range: string; pct: number }[] = [];
    let audienceGender = { female: 0, male: 0, other: 0 };
    let audienceTopCountries: { country: string; pct: number }[] = [];
    try {
      const insightsUrl = new URL(
        `https://graph.facebook.com/v21.0/${accountId}/insights`,
      );
      insightsUrl.searchParams.set('metric', 'follower_demographics');
      insightsUrl.searchParams.set('period', 'lifetime');
      insightsUrl.searchParams.set(
        'breakdown',
        'age,gender,country',
      );
      insightsUrl.searchParams.set('metric_type', 'total_value');
      insightsUrl.searchParams.set('access_token', token);
      const insResp = await fetch(insightsUrl.toString());
      if (insResp.ok) {
        const insJson = (await insResp.json()) as { data?: IgInsight[] };
        const buckets =
          insJson.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
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
    } catch (e) {
      console.warn('[ig profile] insights failed:', e);
    }

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
      source: 'oauth' as const,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      raw: {
        id: user.id,
        name: user.name,
        mediaCount: user.media_count,
        avatarUrl: user.profile_picture_url,
      },
    };

    return new Response(JSON.stringify(profile), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('[ig profile] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
