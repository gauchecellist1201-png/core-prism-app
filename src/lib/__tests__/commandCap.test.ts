import { describe, it, expect } from 'vitest';
import { capByCategory, BROWSE_CAP, SEARCH_CAP, SEARCH_CAP_N } from '../commandCap';

type Row = { id: string; category: string };
const cat = (e: Row) => e.category;

/** category を n 件ずつ作る (id は cat1, cat2 …) */
function rows(spec: Array<[string, number]>): Row[] {
  const out: Row[] = [];
  for (const [category, n] of spec) {
    for (let i = 1; i <= n; i++) out.push({ id: `${category}${i}`, category });
  }
  return out;
}

describe('capByCategory — 打っている時は段ごと3件に畳む', () => {
  it('段ごとに上位3件だけ残し、残りは hidden に数える', () => {
    const { list, hidden } = capByCategory(rows([['nav', 7], ['knowledge', 5]]), cat, SEARCH_CAP);
    expect(list.map(r => r.id)).toEqual(['nav1', 'nav2', 'nav3', 'knowledge1', 'knowledge2', 'knowledge3']);
    expect(hidden.get('nav')).toBe(4);
    expect(hidden.get('knowledge')).toBe(2);
  });

  it('隠した数 + 出した数 = 元の件数（黙って切らない・数を偽らない）', () => {
    const entries = rows([['nav', 9], ['task', 4], ['help', 1]]);
    const { list, hidden } = capByCategory(entries, cat, SEARCH_CAP);
    const hiddenTotal = [...hidden.values()].reduce((a, b) => a + b, 0);
    expect(list.length + hiddenTotal).toBe(entries.length);
  });

  it('上限ちょうど／それ以下の段は hidden に入れない（「ほかに 0 件」を画面に出させない）', () => {
    const { hidden } = capByCategory(rows([['nav', SEARCH_CAP_N], ['help', 1]]), cat, SEARCH_CAP);
    expect(hidden.has('nav')).toBe(false);
    expect(hidden.has('help')).toBe(false);
  });

  it('元の並び順は 1 つも入れ替えない', () => {
    const entries: Row[] = [
      { id: 'a', category: 'saved' },
      { id: 'b', category: 'nav' },
      { id: 'c', category: 'saved' },
      { id: 'd', category: 'nav' },
    ];
    const { list } = capByCategory(entries, cat, SEARCH_CAP);
    expect(list.map(r => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('「すべて見る」を押した段は畳まない（他の段は畳んだまま）', () => {
    const { list, hidden } = capByCategory(
      rows([['nav', 6], ['knowledge', 6]]),
      cat,
      SEARCH_CAP,
      new Set(['nav']),
    );
    expect(list.filter(r => r.category === 'nav')).toHaveLength(6);
    expect(list.filter(r => r.category === 'knowledge')).toHaveLength(3);
    expect(hidden.has('nav')).toBe(false);
    expect(hidden.get('knowledge')).toBe(3);
  });

  it('上限を持たない段は全部出す', () => {
    const { list, hidden } = capByCategory(rows([['ai', 12]]), cat, SEARCH_CAP);
    expect(list).toHaveLength(12);
    expect(hidden.size).toBe(0);
  });
});

describe('capByCategory — 眺めている時 (クエリ空) は今までどおり', () => {
  it('ナビ・作成は畳まない（何ができるのかを見せる menu を削らない）', () => {
    const { list, hidden } = capByCategory(rows([['nav', 20], ['create', 12]]), cat, BROWSE_CAP);
    expect(list).toHaveLength(32);
    expect(hidden.size).toBe(0);
  });

  it('ナレッジ・タスクだけは 8 件で畳む（件数が青天井なので）', () => {
    const { list, hidden } = capByCategory(rows([['knowledge', 30], ['task', 9]]), cat, BROWSE_CAP);
    expect(list.filter(r => r.category === 'knowledge')).toHaveLength(8);
    expect(list.filter(r => r.category === 'task')).toHaveLength(8);
    expect(hidden.get('knowledge')).toBe(22);
    expect(hidden.get('task')).toBe(1);
  });

  it('打っている時の上限は、眺めている時より必ず厳しい（同じ入力で出る数が減る）', () => {
    const entries = rows([['nav', 10], ['knowledge', 10]]);
    const browse = capByCategory(entries, cat, BROWSE_CAP).list.length;
    const search = capByCategory(entries, cat, SEARCH_CAP).list.length;
    expect(search).toBeLessThan(browse);
  });
});

describe('capByCategory — 空の入力', () => {
  it('0 件を渡したら 0 件のまま（隠した数も 0）', () => {
    const { list, hidden } = capByCategory([], cat, SEARCH_CAP);
    expect(list).toEqual([]);
    expect(hidden.size).toBe(0);
  });
});
