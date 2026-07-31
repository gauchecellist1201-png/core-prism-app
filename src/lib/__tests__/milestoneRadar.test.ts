import { describe, it, expect } from 'vitest';
import {
  monthParts, relativeDayLabel, calendarDayDiff,
  monthMilestoneRows, calendarMilestoneRows, revenueGapRow, stalledReplyRows,
  buildRadar, RADAR_MAX_ROWS,
} from '../milestoneRadar';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
/** ローカル時刻で日付を作る（UTCで作るとJSTで前日になってテストが嘘をつく） */
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0);

describe('monthParts', () => {
  it('月末日数と前月をまたいで正しく出す', () => {
    const p = monthParts(at(2026, 8, 1));
    expect(p).toMatchObject({ year: 2026, month: 8, day: 1, lastDay: 31, daysLeft: 30, prevMonth: 7 });
    expect(p.key).toBe('2026-08');
    expect(p.prevKey).toBe('2026-07');
  });

  it('1月は前月が前年の12月になる', () => {
    const p = monthParts(at(2026, 1, 3));
    expect(p.prevYear).toBe(2025);
    expect(p.prevMonth).toBe(12);
    expect(p.prevKey).toBe('2025-12');
  });

  it('うるう年の2月を29日と数える', () => {
    expect(monthParts(at(2028, 2, 10)).lastDay).toBe(29);
    expect(monthParts(at(2026, 2, 10)).lastDay).toBe(28);
  });
});

describe('relativeDayLabel / calendarDayDiff', () => {
  it('今日・明日・あとN日', () => {
    expect(relativeDayLabel(0)).toBe('今日');
    expect(relativeDayLabel(1)).toBe('明日');
    expect(relativeDayLabel(4)).toBe('あと4日');
  });

  it('時刻が違っても同じ日なら0日差（夜23時と翌朝1時を2日と数えない）', () => {
    expect(calendarDayDiff(at(2026, 8, 1, 23), at(2026, 8, 1, 1))).toBe(0);
    expect(calendarDayDiff(at(2026, 8, 1, 23), at(2026, 8, 2, 1))).toBe(1);
  });
});

describe('月の節目', () => {
  it('8月1日は「7月が締まりました」を出す', () => {
    const rows = monthMilestoneRows(at(2026, 8, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('month-open');
    expect(rows[0].title).toBe('7月が締まりました');
  });

  it('1月3日は前年12月を指す', () => {
    expect(monthMilestoneRows(at(2026, 1, 3))[0].title).toBe('12月が締まりました');
  });

  it('月の真ん中は何も出さない（毎日うるさく言わない）', () => {
    expect(monthMilestoneRows(at(2026, 8, 15))).toHaveLength(0);
  });

  it('月末3日前から締めが近いと出す', () => {
    const rows = monthMilestoneRows(at(2026, 8, 29));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('month-close');
    expect(rows[0].title).toBe('8月の締めまで、あと2日');
  });

  it('最終日は「今日が最終日」と言う', () => {
    const rows = monthMilestoneRows(at(2026, 8, 31));
    expect(rows[0].title).toBe('今日が8月の最終日です');
    expect(rows[0].when).toBe('今日');
  });

  it('2月28日(平年)は最終日として扱う', () => {
    expect(monthMilestoneRows(at(2026, 2, 28))[0].title).toBe('今日が2月の最終日です');
  });

  it('月初と月末が同時に出ない（2月のような短い月でも重ならない）', () => {
    for (let d = 1; d <= 28; d++) {
      const kinds = monthMilestoneRows(at(2026, 2, d)).map((r) => r.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(kinds.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('カレンダーの節目', () => {
  const ev = (id: string, summary: string, day: number) => ({
    id, summary, start: at(2026, 8, day, 10).toISOString(),
  });

  it('お金・期限に関わる予定だけを拾う', () => {
    const rows = calendarMilestoneRows(at(2026, 8, 10), [
      ev('a', 'ランチ', 11),
      ev('b', '家賃の支払', 12),
      ev('c', '定例ミーティング', 13),
      ev('d', 'A社へ請求書提出', 14),
    ]);
    expect(rows.map((r) => r.title)).toEqual(['家賃の支払', 'A社へ請求書提出']);
  });

  it('近い順に並べ、今日・明日は警告にする', () => {
    const rows = calendarMilestoneRows(at(2026, 8, 10), [
      ev('a', '納品の締切', 15),
      ev('b', 'カード引き落とし', 11),
    ]);
    expect(rows[0].title).toBe('カード引き落とし');
    expect(rows[0].tone).toBe('alert');
    expect(rows[0].when).toBe('明日');
    expect(rows[1].tone).toBe('idea');
  });

  it('過ぎた予定と、範囲より先の予定は出さない', () => {
    const rows = calendarMilestoneRows(at(2026, 8, 10), [
      ev('a', '支払期限', 9),   // 昨日
      ev('b', '支払期限', 20),  // 10日先
    ]);
    expect(rows).toHaveLength(0);
  });

  it('種類によって説明を変える', () => {
    const [pay] = calendarMilestoneRows(at(2026, 8, 10), [ev('a', '外注費の振込', 12)]);
    expect(pay.detail).toContain('残高を先に確かめて');
    const [ctr] = calendarMilestoneRows(at(2026, 8, 10), [ev('b', 'サーバー契約の更新', 12)]);
    expect(ctr.detail).toContain('契約の節目');
  });

  it('壊れた日付・空の予定名でも落ちない', () => {
    const rows = calendarMilestoneRows(at(2026, 8, 10), [
      { id: 'x', summary: '請求', start: 'not-a-date' },
      { id: 'y', summary: '   ', start: at(2026, 8, 11).toISOString() },
    ]);
    expect(rows).toHaveLength(0);
  });

  it('最大3件までしか出さない', () => {
    const many = [12, 13, 14, 15, 16].map((d) => ev(`e${d}`, `請求${d}`, d));
    expect(calendarMilestoneRows(at(2026, 8, 10), many)).toHaveLength(3);
  });
});

describe('入金の欠け', () => {
  const monthly = [
    { month: '2026-06', mrrJpy: 400000 },
    { month: '2026-07', mrrJpy: 500000 },
    { month: '2026-08', mrrJpy: 0 },
  ];

  it('月初は黙る（1日に「今月0円」は誤報になるから）', () => {
    expect(revenueGapRow(at(2026, 8, 1), monthly, yen)).toBeNull();
    expect(revenueGapRow(at(2026, 8, 4), monthly, yen)).toBeNull();
  });

  it('5日を過ぎて0円なら警告する', () => {
    const row = revenueGapRow(at(2026, 8, 5), monthly, yen)!;
    expect(row).not.toBeNull();
    expect(row.tone).toBe('alert');
    expect(row.title).toBe('7月はあったのに、8月の入金がまだ0円です');
    expect(row.detail).toContain('¥500,000');
  });

  it('今月の行が無い（＝1件も入っていない）場合も同じ扱い', () => {
    const row = revenueGapRow(at(2026, 8, 10), monthly.slice(0, 2), yen);
    expect(row?.kind).toBe('revenue-zero');
  });

  it('今月すでに入金があれば何も言わない', () => {
    const ok = [...monthly.slice(0, 2), { month: '2026-08', mrrJpy: 120000 }];
    expect(revenueGapRow(at(2026, 8, 20), ok, yen)).toBeNull();
  });

  it('比べる先月が無い／先月も0円なら黙る（使い始めの人に嘘の警告を出さない）', () => {
    expect(revenueGapRow(at(2026, 8, 20), [{ month: '2026-08', mrrJpy: 0 }], yen)).toBeNull();
    expect(revenueGapRow(at(2026, 8, 20), [{ month: '2026-07', mrrJpy: 0 }], yen)).toBeNull();
    expect(revenueGapRow(at(2026, 8, 20), [], yen)).toBeNull();
    expect(revenueGapRow(at(2026, 8, 20), null, yen)).toBeNull();
  });
});

describe('返事が止まっている相手', () => {
  it('放置が長い順に、最大2件', () => {
    const rows = stalledReplyRows([
      { threadId: '1', who: '山田', subject: '見積の件', days: 4 },
      { threadId: '2', who: '鈴木', subject: '契約書', days: 9 },
      { threadId: '3', who: '佐藤', subject: '日程', days: 6 },
    ]);
    expect(rows.map((r) => r.when)).toEqual(['9日', '6日']);
    expect(rows[0].tone).toBe('alert'); // 7日以上
    expect(rows[1].tone).toBe('idea');
    expect(rows[0].title).toBe('鈴木 さんに、まだ返せていません');
  });

  it('件名が空でも文章が壊れない', () => {
    const [r] = stalledReplyRows([{ threadId: '1', who: '山田', subject: '', days: 3 }]);
    expect(r.detail).toContain('(件名なし)');
  });
});

describe('まとめ（優先順位と件数）', () => {
  it('困っている物 → 節目 の順に並ぶ', () => {
    const rows = buildRadar({
      now: at(2026, 8, 2),
      events: [{ id: 'a', summary: '請求書の締切', start: at(2026, 8, 6).toISOString() }],
      monthly: [{ month: '2026-07', mrrJpy: 500000 }],
      stalled: [{ threadId: '1', who: '山田', subject: '見積', days: 5 }],
      fmtJpy: yen,
    });
    // 8/2 は月初のため入金ゼロ判定は黙る（誤報ガード）
    expect(rows.map((r) => r.kind)).toEqual(['cal-deadline', 'stalled-reply', 'month-open']);
  });

  it('今日・明日の予定は、入金ゼロの警告より先に出す', () => {
    const rows = buildRadar({
      now: at(2026, 8, 20),
      events: [{ id: 'a', summary: '納品の期限', start: at(2026, 8, 20, 18).toISOString() }],
      monthly: [{ month: '2026-07', mrrJpy: 500000 }, { month: '2026-08', mrrJpy: 0 }],
      fmtJpy: yen,
    });
    expect(rows[0].kind).toBe('cal-deadline');
    expect(rows[0].when).toBe('今日');
    expect(rows[1].kind).toBe('revenue-zero');
  });

  it('出しすぎない', () => {
    const rows = buildRadar({
      now: at(2026, 8, 5),
      events: [12, 13, 14].map((d) => ({ id: `e${d}`, summary: `請求${d}`, start: at(2026, 8, d).toISOString() })),
      monthly: [{ month: '2026-07', mrrJpy: 500000 }, { month: '2026-08', mrrJpy: 0 }],
      stalled: [
        { threadId: '1', who: '山田', subject: 'a', days: 4 },
        { threadId: '2', who: '鈴木', subject: 'b', days: 8 },
      ],
      fmtJpy: yen,
    });
    expect(rows.length).toBe(RADAR_MAX_ROWS);
  });

  it('材料が何も無い月の真ん中は、1件も出ない（カードごと消える）', () => {
    expect(buildRadar({ now: at(2026, 8, 15), fmtJpy: yen })).toHaveLength(0);
  });
});
