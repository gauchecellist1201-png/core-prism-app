import { describe, it, expect } from 'vitest';
import {
  zoomIn, zoomOut, pinchStep, pinchDistance, weekStart, weekCells, shiftByZoom,
  parseDayKey, anchorOnZoomChange, zoomLabel, navLabel, startOfDay,
  PINCH_IN_RATIO, PINCH_OUT_RATIO, type CalZoom,
} from '../calendarZoom';

// 2026-09-09 は水曜。その週は 9/6(日) 〜 9/12(土)
const WED = new Date(2026, 8, 9, 15, 30);

describe('段の出入り（月 → 週 → 日）', () => {
  it('ひらくと細かく、とじると広くなる', () => {
    expect(zoomIn('month')).toBe('week');
    expect(zoomIn('week')).toBe('day');
    expect(zoomOut('day')).toBe('week');
    expect(zoomOut('week')).toBe('month');
  });

  it('端では止まる（月より外・日より内へ行かない）', () => {
    expect(zoomOut('month')).toBe('month');
    expect(zoomIn('day')).toBe('day');
  });

  it('知らない段が来ても落ちず、月に戻る', () => {
    expect(zoomIn('zzz' as CalZoom)).toBe('month');
    expect(zoomOut('zzz' as CalZoom)).toBe('month');
  });
});

describe('2本指の開き具合', () => {
  it('しきい値まで開いて初めて1段ぶん動く（触っただけでは動かない）', () => {
    expect(pinchStep(100, 100)).toBe(0);
    expect(pinchStep(100, 110)).toBe(0);                 // 1.10倍 = まだ
    expect(pinchStep(100, 100 * PINCH_IN_RATIO)).toBe(1); // ちょうど1.25倍
    expect(pinchStep(100, 300)).toBe(1);                  // 開きすぎても1段まで
  });

  it('とじた時は逆向きに1段', () => {
    expect(pinchStep(100, 90)).toBe(0);                    // 0.90倍 = まだ
    expect(pinchStep(100, 100 * PINCH_OUT_RATIO)).toBe(-1); // ちょうど0.8倍
    expect(pinchStep(100, 1)).toBe(-1);                     // つまんでも1段まで
  });

  it('測れない指の位置では絶対に段を動かさない（勝手に画面が変わらない）', () => {
    expect(pinchStep(0, 200)).toBe(0);
    expect(pinchStep(-10, 200)).toBe(0);
    expect(pinchStep(100, 0)).toBe(0);
    expect(pinchStep(NaN, 200)).toBe(0);
    expect(pinchStep(100, NaN)).toBe(0);
    expect(pinchStep(Infinity, 200)).toBe(0);
  });

  it('指の間の距離（3-4-5 の直角三角形）', () => {
    expect(pinchDistance(0, 0, 3, 4)).toBe(5);
    expect(pinchDistance(10, 10, 10, 10)).toBe(0);
    expect(pinchDistance(NaN, 0, 3, 4)).toBe(0);
  });
});

describe('週の切り出し', () => {
  it('週のはじまりは日曜の 00:00（時刻を持ち越さない）', () => {
    const s = weekStart(WED);
    expect([s.getFullYear(), s.getMonth() + 1, s.getDate()]).toEqual([2026, 9, 6]);
    expect(s.getDay()).toBe(0);
    expect([s.getHours(), s.getMinutes(), s.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('7日ぶんが日曜から土曜まで、月をまたいでも連続する', () => {
    const cells = weekCells(new Date(2026, 8, 30)); // 9/30(水) の週 = 9/27〜10/3
    expect(cells).toHaveLength(7);
    expect(cells.map(d => `${d.getMonth() + 1}/${d.getDate()}`)).toEqual(
      ['9/27', '9/28', '9/29', '9/30', '10/1', '10/2', '10/3'],
    );
  });

  it('日曜そのものを渡してもその週のまま（前の週へ戻らない）', () => {
    const sun = new Date(2026, 8, 6, 23, 59);
    expect(weekStart(sun).getDate()).toBe(6);
  });
});

describe('◀ ▶ は「いま見ている段」のぶんだけ動く', () => {
  it('月は1か月、週は7日、日は1日', () => {
    const m = shiftByZoom(new Date(2026, 8, 1), 'month', 1);
    expect([m.getFullYear(), m.getMonth() + 1, m.getDate()]).toEqual([2026, 10, 1]);

    const w = shiftByZoom(WED, 'week', 1);
    expect([w.getMonth() + 1, w.getDate()]).toEqual([9, 16]);

    const d = shiftByZoom(WED, 'day', -1);
    expect([d.getMonth() + 1, d.getDate()]).toEqual([9, 8]);
  });

  it('年をまたいでも壊れない', () => {
    const back = shiftByZoom(new Date(2026, 0, 1), 'month', -1);
    expect([back.getFullYear(), back.getMonth() + 1]).toEqual([2025, 12]);
    const fwd = shiftByZoom(new Date(2026, 11, 31), 'day', 1);
    expect([fwd.getFullYear(), fwd.getMonth() + 1, fwd.getDate()]).toEqual([2027, 1, 1]);
  });

  it('月をまたぐ週送りで「31日→存在しない日」に化けない', () => {
    const w = shiftByZoom(new Date(2026, 0, 31), 'week', 1); // 1/31 + 7 = 2/7
    expect([w.getMonth() + 1, w.getDate()]).toEqual([2, 7]);
  });
});

describe('日付キー（ISO を切らずローカルで作る）', () => {
  it('読める形だけ通す', () => {
    const d = parseDayKey('2026-09-09');
    expect(d && [d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 9]);
  });

  it('存在しない日・壊れた文字列は null（勝手に別の日へ繰り上げない）', () => {
    expect(parseDayKey('2026-02-31')).toBeNull();
    expect(parseDayKey('2026-13-01')).toBeNull();
    expect(parseDayKey('2026-09-00')).toBeNull();
    expect(parseDayKey('2026-9-9')).toBeNull();
    expect(parseDayKey('')).toBeNull();
    expect(parseDayKey('きょう')).toBeNull();
  });
});

describe('段を変えた時に見ている日を見失わない', () => {
  const today = new Date(2026, 8, 9, 10, 0);

  it('月へ上がる時は、いま見ている場所を動かさない', () => {
    const cur = new Date(2026, 8, 1);
    expect(anchorOnZoomChange('month', cur, '2026-09-20', today)).toBe(cur);
  });

  it('降りる時は、選んでいる日があればそこへ', () => {
    const a = anchorOnZoomChange('week', new Date(2026, 8, 1), '2026-09-20', today);
    expect([a.getMonth() + 1, a.getDate()]).toEqual([9, 20]);
  });

  it('選んでいなければ、いま見ている月の中の「きょう」へ', () => {
    const a = anchorOnZoomChange('day', new Date(2026, 8, 1), '', today);
    expect([a.getMonth() + 1, a.getDate()]).toEqual([9, 9]);
    expect(a.getHours()).toBe(0);
  });

  it('別の月を見ている時は「きょう」へ飛ばさず、その月に留まる', () => {
    const a = anchorOnZoomChange('week', new Date(2025, 11, 1), '', today);
    expect([a.getFullYear(), a.getMonth() + 1, a.getDate()]).toEqual([2025, 12, 1]);
  });

  it('壊れた選択日は無視して、きょうへ落ちる（落ちない・飛ばない）', () => {
    const a = anchorOnZoomChange('week', new Date(2026, 8, 1), '2026-02-31', today);
    expect([a.getMonth() + 1, a.getDate()]).toEqual([9, 9]);
  });
});

describe('見出しと読み上げ', () => {
  it('段ごとに、いま見ている範囲をそのまま言う', () => {
    expect(zoomLabel(new Date(2026, 8, 1), 'month')).toBe('2026年 9月');
    expect(zoomLabel(WED, 'week')).toBe('9月6日 - 9月12日');
    expect(zoomLabel(WED, 'day')).toBe('9月9日 (水)');
  });

  it('年をまたぐ週は年から言う（12月31日 - 1月6日 が同じ年に見えない）', () => {
    expect(zoomLabel(new Date(2025, 11, 31), 'week')).toBe('2025年 12月28日 - 1月3日');
  });

  it('◀ ▶ の読み上げも段に合わせる', () => {
    expect(navLabel('month', -1)).toBe('前の月');
    expect(navLabel('week', 1)).toBe('次の週');
    expect(navLabel('day', -1)).toBe('前の日');
  });

  it('startOfDay は時刻を落とすだけで日付をずらさない', () => {
    const s = startOfDay(new Date(2026, 8, 9, 23, 59, 59));
    expect([s.getMonth() + 1, s.getDate(), s.getHours()]).toEqual([9, 9, 0]);
  });
});
