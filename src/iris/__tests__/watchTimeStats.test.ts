import { describe, it, expect } from 'vitest';
import {
  avgWatchSeconds, watchTimeLine, MIN_SAMPLES_FOR_AVG,
} from '../watchTimeStats';

function post(sec: number | undefined, daysAgo: number, extra: Record<string, unknown> = {}) {
  return {
    id: `p${daysAgo}`,
    postedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    metrics: { reach: 100, ...(sec === undefined ? {} : { avgWatchSec: sec }), ...extra },
  };
}

describe('avgWatchSeconds — 実測が3本そろった時だけ言う', () => {
  it('3本そろえば平均を小数第1位で返す', () => {
    const r = avgWatchSeconds([post(4, 1), post(5, 2), post(6, 3)]);
    expect(r).toEqual({ avgSec: 5, count: 3 });
  });

  it('2本では何も返さない（1本や2本の平均は平均ではない）', () => {
    expect(avgWatchSeconds([post(4, 1), post(5, 2)])).toBeNull();
    expect(avgWatchSeconds([post(4, 1)])).toBeNull();
    expect(MIN_SAMPLES_FOR_AVG).toBe(3);
  });

  it('★取れていない投稿を 0 秒として混ぜない（混ぜると平均が嘘になる）', () => {
    // 実測は 6/6/6 の3本だけ。取れていない2本を 0 で数えると 3.6 秒になってしまう。
    const r = avgWatchSeconds([post(6, 1), post(6, 2), post(6, 3), post(undefined, 4), post(undefined, 5)]);
    expect(r).toEqual({ avgSec: 6, count: 3 });
  });

  it('0・負・非数は実測として扱わない', () => {
    expect(avgWatchSeconds([post(0, 1), post(-3, 2), post(6, 3)])).toBeNull();
    expect(avgWatchSeconds([
      { postedAt: '2026-09-01', metrics: { avgWatchSec: '5' } },
      post(6, 2), post(6, 3),
    ])).toBeNull();
  });

  it('新しい順に上限本数まで（古い実績を混ぜない）', () => {
    const posts = [post(10, 1), post(10, 2), post(10, 3), post(1, 40), post(1, 41)];
    expect(avgWatchSeconds(posts, 3)).toEqual({ avgSec: 10, count: 3 });
  });

  it('日付が壊れていても落ちず、本数がそろえば平均は出る', () => {
    const broken = [
      { postedAt: 'ぜんぜん日付じゃない', metrics: { avgWatchSec: 3 } },
      { postedAt: undefined, metrics: { avgWatchSec: 3 } },
      { metrics: { avgWatchSec: 3 } },
    ];
    expect(avgWatchSeconds(broken)).toEqual({ avgSec: 3, count: 3 });
  });

  it('壊れた入力で嘘の在庫を見せない', () => {
    expect(avgWatchSeconds(null)).toBeNull();
    expect(avgWatchSeconds('[]')).toBeNull();
    expect(avgWatchSeconds([null, undefined, 3, 'x'])).toBeNull();
    expect(avgWatchSeconds([{ metrics: null }, { metrics: 5 }, {}])).toBeNull();
    expect(avgWatchSeconds([post(5, 1), post(5, 2), post(5, 3)], 0)).toBeNull();
  });

  it('渡した配列を書き換えない（並べ替えの副作用ゼロ）', () => {
    const posts = [post(1, 9), post(2, 1), post(3, 5)];
    const before = posts.map(p => p.id);
    avgWatchSeconds(posts);
    expect(posts.map(p => p.id)).toEqual(before);
  });
});

describe('watchTimeLine — 出せない時は行ごと出さない', () => {
  it('null なら null（「—」も「0秒」も作らない）', () => {
    expect(watchTimeLine(null)).toBeNull();
  });
  it('実測だと分かる言い方で、本数と秒を出す', () => {
    const line = watchTimeLine({ avgSec: 5.4, count: 7 });
    expect(line).toContain('実測');
    expect(line).toContain('7 本');
    expect(line).toContain('5.4 秒');
  });
  it('割り切れる時も小数第1位を落とさない（5秒と5.0秒で見え方が揺れない）', () => {
    expect(watchTimeLine({ avgSec: 5, count: 3 })).toContain('5.0 秒');
  });
});

// ── 取り込み側: 実数を undefined で上書きしない ──────────
import { definedOnly } from '../instagramConnect';

describe('definedOnly — 取れなかった今回で、前回の実数を消さない', () => {
  it('undefined の鍵を落とすので、マージしても既存の実数が残る', () => {
    const existing = { reach: 900, saves: 12, avgWatchSec: 5.4 };
    const incoming = definedOnly({ reach: undefined, saves: undefined, likes: 3, avgWatchSec: undefined });
    expect({ ...existing, ...incoming }).toEqual({ reach: 900, saves: 12, avgWatchSec: 5.4, likes: 3 });
  });
  it('新しい実数はちゃんと上書きする', () => {
    expect({ ...{ reach: 1 }, ...definedOnly({ reach: 900 }) }).toEqual({ reach: 900 });
  });
  it('NaN / Infinity も実数として扱わない', () => {
    expect(definedOnly({ a: NaN, b: Infinity, c: 0 })).toEqual({ c: 0 });
  });
});
