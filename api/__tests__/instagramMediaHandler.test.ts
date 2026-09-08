import { describe, it, expect, beforeEach, vi } from 'vitest';

// /api/instagram/media の handler を、Instagram Graph をモックして通す。
//   ・reach/saved は従来どおり取れる
//   ・平均視聴時間は「動画にだけ」別リクエストで聞く
//   ・★視聴時間のリクエストが落ちても reach/saved は巻き添えにならない
//   ・取れない投稿には avgWatchSeconds を返さない (0 も返さない)
import handler from '../instagram/media';

const asked: string[] = [];
type Reply = { ok: boolean; body: unknown };
let insightsReply: (mediaId: string, metric: string) => Reply;

const MEDIA = [
  { id: 'v1', media_type: 'VIDEO', permalink: 'https://ig/1', timestamp: '2026-09-01T00:00:00Z', like_count: 3, comments_count: 1 },
  { id: 'i1', media_type: 'IMAGE', permalink: 'https://ig/2', timestamp: '2026-09-02T00:00:00Z', like_count: 5, comments_count: 0 },
];

function mockFetch(media = MEDIA) {
  asked.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(String(url));
    if (u.pathname.endsWith('/me/media')) {
      return new Response(JSON.stringify({ data: media }), { status: 200 });
    }
    const mediaId = u.pathname.split('/').filter(Boolean).slice(-2)[0];
    const metric = u.searchParams.get('metric') || '';
    asked.push(`${mediaId}:${metric}`);
    const r = insightsReply(mediaId, metric);
    return new Response(JSON.stringify(r.body), { status: r.ok ? 200 : 400 });
  }));
}

function ok(names: Record<string, number>): Reply {
  return { ok: true, body: { data: Object.entries(names).map(([name, value]) => ({ name, values: [{ value }] })) } };
}
const FAIL: Reply = { ok: false, body: { error: { message: 'metric not supported' } } };

function req(cookie = 'ig_access_token=tok') {
  return new Request('https://app.test/api/instagram/media', { headers: { cookie } });
}
async function mediaOf(res: Response) {
  return (await res.json()).media as Record<string, unknown>[];
}

describe('/api/instagram/media handler', () => {
  beforeEach(() => {
    insightsReply = (_id, metric) =>
      metric === 'reach,saved' ? ok({ reach: 900, saved: 12 }) : ok({ ig_reels_avg_watch_time: 5400 });
    mockFetch();
  });

  it('未連携なら 401 で、Instagram を一度も叩かない', async () => {
    const res = await handler(req(''));
    expect(res.status).toBe(401);
    expect(asked).toEqual([]);
  });

  it('動画には視聴時間を聞き、画像には聞かない（画像に聞くと 400 になる指標）', async () => {
    await handler(req());
    expect(asked).toContain('v1:reach,saved');
    expect(asked).toContain('v1:ig_reels_avg_watch_time');
    expect(asked).toContain('i1:reach,saved');
    expect(asked).not.toContain('i1:ig_reels_avg_watch_time');
  });

  it('ミリ秒を秒（小数第1位）に直して返す', async () => {
    const media = await mediaOf(await handler(req()));
    expect(media[0].avgWatchSeconds).toBe(5.4);
    expect(media[1].avgWatchSeconds).toBeUndefined();
  });

  it('★視聴時間が落ちても reach/saved は残る（同じ metric に足していたら両方消えていた）', async () => {
    insightsReply = (_id, metric) => (metric === 'reach,saved' ? ok({ reach: 900, saved: 12 }) : FAIL);
    mockFetch();
    const media = await mediaOf(await handler(req()));
    expect(media[0].reach).toBe(900);
    expect(media[0].saved).toBe(12);
    expect(media[0].avgWatchSeconds).toBeUndefined();
  });

  it('視聴時間が 0 / 負 / 数値でない時は返さない（0 秒と言い切ると嘘になる）', async () => {
    for (const bad of [0, -1, 'ゼロ', null]) {
      insightsReply = (_id, metric) =>
        metric === 'reach,saved' ? ok({ reach: 1, saved: 0 })
          : { ok: true, body: { data: [{ name: 'ig_reels_avg_watch_time', values: [{ value: bad }] }] } };
      mockFetch();
      const media = await mediaOf(await handler(req()));
      expect(media[0].avgWatchSeconds).toBeUndefined();
    }
  });

  it('reach/saved が丸ごと落ちても 200 のまま（1投稿の失敗で全体を落とさない）', async () => {
    insightsReply = () => FAIL;
    mockFetch();
    const res = await handler(req());
    expect(res.status).toBe(200);
    const media = await mediaOf(res);
    expect(media).toHaveLength(2);
    expect(media[0].reach).toBeUndefined();
    expect(media[0].likes).toBe(3);
  });

  it('media_type が REELS / 小文字でも動画として扱う', async () => {
    mockFetch([{ id: 'r1', media_type: 'REELS', permalink: 'https://ig/3' }, { id: 'r2', media_type: 'video', permalink: 'https://ig/4' }]);
    await handler(req());
    expect(asked).toContain('r1:ig_reels_avg_watch_time');
    expect(asked).toContain('r2:ig_reels_avg_watch_time');
  });
});
