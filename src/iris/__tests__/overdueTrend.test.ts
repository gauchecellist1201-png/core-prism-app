import { describe, it, expect } from 'vitest';
import {
  recordSnapshot, summarizeTrend, sanitizeTrend, trendSentence, localDayKey, formatTrendDay,
  OVERDUE_TREND_MAX_DAYS, type OverdueSnapshot,
} from '../overdueTrend';

const day = (iso: string) => new Date(iso);
const D1 = day('2026-08-27T09:00:00+09:00');
const D2 = day('2026-08-29T09:00:00+09:00');
const D2_LATER = day('2026-08-29T21:00:00+09:00');

describe('1日以上ほったらかしの予約を数え続ける記録', () => {
  it('その日の1回目が「前」になり、2回目以降は「いま」だけが動く', () => {
    let h = recordSnapshot([], 5, D2);
    expect(h).toEqual([{ day: '2026-08-29', first: 5, last: 5 }]);
    h = recordSnapshot(h, 2, D2_LATER);
    expect(h).toEqual([{ day: '2026-08-29', first: 5, last: 2 }]);
  });

  it('日をまたぐと行が増える（上書きしない）', () => {
    const h = recordSnapshot(recordSnapshot([], 5, D1), 2, D2);
    expect(h.map(r => r.day)).toEqual(['2026-08-27', '2026-08-29']);
  });

  it('数えられない値は記録しない（記録を壊さない）', () => {
    const base: OverdueSnapshot[] = [{ day: '2026-08-27', first: 5, last: 5 }];
    expect(recordSnapshot(base, NaN, D2)).toEqual(base);
    expect(recordSnapshot(base, -1, D2)).toEqual(base);
    expect(recordSnapshot(base, Infinity, D2)).toEqual(base);
  });

  it('壊れた記録は読み捨てる（localStorage を信じない）', () => {
    expect(sanitizeTrend(null)).toEqual([]);
    expect(sanitizeTrend('こわれてる')).toEqual([]);
    expect(sanitizeTrend([{ day: 'きのう', first: 1, last: 1 }, { day: '2026-08-29', first: 'x', last: 1 }])).toEqual([]);
    expect(sanitizeTrend([{ day: '2026-08-29', first: 1, last: 1 }, { day: '2026-08-29', first: 9, last: 3 }]))
      .toEqual([{ day: '2026-08-29', first: 9, last: 3 }]);
  });

  it('古い記録は落とす（増え続けない）', () => {
    let h: OverdueSnapshot[] = [];
    for (let i = 0; i < OVERDUE_TREND_MAX_DAYS + 10; i++) {
      h = recordSnapshot(h, 1, new Date(2026, 0, 1 + i, 9));
    }
    expect(h.length).toBe(OVERDUE_TREND_MAX_DAYS);
  });

  it('記録が1日も無ければ「前」を作らない（架空の比較を出さない）', () => {
    const t = summarizeTrend([], 3, D2);
    expect(t).toEqual({ now: 3, todayFirst: null, since: null });
    expect(trendSentence(t)).toBe('1日以上ほったらかしの予約が、いま3件あります');
  });

  it('きょうの中だけでも、開いたときとの差は言える', () => {
    const h = recordSnapshot([], 5, D2);
    expect(trendSentence(summarizeTrend(h, 2, D2_LATER)))
      .toBe('1日以上ほったらかしの予約が、いま2件あります（きょう開いたときは5件）');
  });

  it('数えはじめた日と比べる（途中の日を混ぜない）', () => {
    let h = recordSnapshot([], 5, D1);
    h = recordSnapshot(h, 4, day('2026-08-28T09:00:00+09:00'));
    const t = summarizeTrend(h, 0, D2);
    expect(t?.since).toEqual({ day: '2026-08-27', count: 5 });
    expect(trendSentence(t)).toBe('1日以上ほったらかしの予約は、いま0件です（8月27日に数えはじめたときは5件）');
  });

  it('数えられない「いま」では何も出さない', () => {
    expect(summarizeTrend([], NaN, D2)).toBeNull();
    expect(trendSentence(null)).toBe('');
  });

  it('日付キーはローカル時刻（ISO の slice で前日にずれない）', () => {
    expect(localDayKey(new Date('2026-08-29T00:30:00+09:00'))).toBe('2026-08-29');
    expect(formatTrendDay('2026-08-27')).toBe('8月27日');
    expect(formatTrendDay('こわれてる')).toBe('こわれてる');
  });

  it('文言に責める語を入れない', () => {
    const t = summarizeTrend(recordSnapshot([], 5, D1), 3, D2);
    const s = trendSentence(t);
    ['できていません', '放置', 'サボ', '失敗', '守れ'].forEach(w => expect(s).not.toContain(w));
  });
});
