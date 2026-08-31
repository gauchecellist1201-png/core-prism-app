import { describe, it, expect } from 'vitest';
import { rankScore, matchScore, usageBonus, compareRanked, USAGE_BONUS_MAX } from '../commandScore';

/** 画面と同じ形で並べ替える (CommandPalette の scored.sort と同じ手順) */
function rank(
  items: Array<{ label: string; subtitle?: string; count?: number }>,
  query: string,
): string[] {
  const parts = query.trim().toLowerCase().split(/\s+/);
  const scored = items
    .map(it => ({ it, score: rankScore(it.label, it.subtitle, parts, it.count), count: it.count ?? 0 }))
    .filter((x): x is { it: typeof items[number]; score: number; count: number } => x.score !== null);
  scored.sort(compareRanked);
  return scored.map(s => s.it.label);
}

describe('当たり方の点数 (これまでの並びを壊していないこと)', () => {
  it('語が当たらなければ null = 一覧に出さない', () => {
    expect(matchScore('売上台帳', '月次の数字', ['請求'])).toBeNull();
  });
  it('複数語は AND (片方でも外れたら出さない)', () => {
    expect(matchScore('売上台帳', '月次の数字', ['売上', '月次'])).not.toBeNull();
    expect(matchScore('売上台帳', '月次の数字', ['売上', '請求'])).toBeNull();
  });
  it('先頭一致 +10 / ラベルに含む +5 / 説明文だけ +1', () => {
    expect(matchScore('売上台帳', undefined, ['売上'])).toBe(10);
    expect(matchScore('月次売上', undefined, ['売上'])).toBe(5);
    expect(matchScore('今日のレポート', '売上をまとめる', ['売上'])).toBe(1);
  });
  it('回数が 0 のときは、これまでとまったく同じ並びになる', () => {
    const items = [
      { label: '今日のレポート', subtitle: '売上をまとめる' },
      { label: '月次売上' },
      { label: '売上台帳' },
    ];
    expect(rank(items, '売上')).toEqual(['売上台帳', '月次売上', '今日のレポート']);
  });
});

describe('使った回数の加点', () => {
  it('0 回・未定義・マイナスは 0 点', () => {
    expect(usageBonus(0)).toBe(0);
    expect(usageBonus(undefined)).toBe(0);
    expect(usageBonus(-3)).toBe(0);
  });
  it('上限で頭打ちになる (999 回押しても 4 点まで)', () => {
    expect(usageBonus(999)).toBe(USAGE_BONUS_MAX);
    expect(usageBonus(2)).toBe(2);
  });
  it('★毎日押している項目が、一度も押していない項目より上に来る (同じ当たり方の中で)', () => {
    const items = [
      { label: '月次売上サマリ' },                 // 一度も使っていない
      { label: '前年比 売上グラフ', count: 6 },     // 毎日押している
    ];
    expect(rank(items, '売上')[0]).toBe('前年比 売上グラフ');
  });
  it('★先頭一致は、何回使われた相手にも抜かれない (並びをゆらさない)', () => {
    const items = [
      { label: '月次売上', count: 999 },  // 含む + 使い倒している
      { label: '売上台帳' },              // 先頭一致 + 一度も使っていない
    ];
    expect(rank(items, '売上')[0]).toBe('売上台帳');
  });
  it('先頭一致どうしは、よく使う方が上', () => {
    const items = [
      { label: '売上台帳' },
      { label: '売上グラフ', count: 3 },
    ];
    expect(rank(items, '売上')[0]).toBe('売上グラフ');
  });
  it('説明文だけの当たりは、よく使うと「含む」と同点になり回数で上に出る (意図した唯一の段またぎ)', () => {
    const items = [
      { label: '月次売上' },                                    // 含む・0 回 = 5
      { label: '今日のレポート', subtitle: '売上', count: 9 },   // 説明文だけ・上限 = 1+4 = 5
    ];
    expect(rank(items, '売上')[0]).toBe('今日のレポート');
  });
  it('同点・同回数なら元の並びを崩さない (安定ソート)', () => {
    expect(compareRanked({ score: 5, count: 2 }, { score: 5, count: 2 })).toBe(0);
  });
});

describe('逆テスト (壊した実装ならちゃんと赤くなること)', () => {
  const items = [
    { label: '月次売上', count: 999 },
    { label: '売上台帳' },
    { label: '今日のレポート', subtitle: '売上', count: 9 },
  ];
  function rankWith(bonusMax: number): string[] {
    const parts = ['売上'];
    const scored = items
      .map(it => {
        const base = matchScore(it.label, it.subtitle, parts);
        return base === null ? null : { it, score: base + Math.min(it.count ?? 0, bonusMax), count: it.count ?? 0 };
      })
      .filter((x): x is { it: typeof items[number]; score: number; count: number } => x !== null);
    scored.sort(compareRanked);
    return scored.map(s => s.it.label);
  }
  it('上限を 8 (= 元の案) にすると、先頭一致が 1 番手から落ちる', () => {
    expect(rankWith(8)[0]).not.toBe('売上台帳');
    expect(rank(items, '売上')[0]).toBe('売上台帳'); // 本実装は落ちない
  });
  it('上限を 0 (= 加点なし) にすると、毎日押している項目が上に来ない', () => {
    expect(rankWith(0)).toEqual(['売上台帳', '月次売上', '今日のレポート']);
  });
  it('上限 5 でも先頭一致が落ちる = 4 が上限であることに意味がある', () => {
    expect(rankWith(5)[0]).not.toBe('売上台帳');
  });
});
