import { describe, it, expect } from 'vitest';
import type { KnowledgeItem } from '../../types/identity';
import {
  relatedKnowledge, agoLabel, ageInDays, queryFromItem, OLD_SLOT_MIN_DAYS,
} from '../relatedKnowledge';

const NOW = new Date('2026-08-18T00:00:00+09:00');

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

function item(over: Partial<KnowledgeItem> & { id: string }): KnowledgeItem {
  return {
    personaId: 'ceo',
    title: '',
    content: '',
    chunks: [],
    sourceType: 'note',
    createdAt: daysAgo(1),
    tags: [],
    ...over,
  } as KnowledgeItem;
}

describe('relatedKnowledge — 訊かなくても隣に出る', () => {
  it('関係のあるものが1件も無いときは、枠ごと出さない（空の器を作らない）', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書', tags: ['契約'] });
    const other = item({ id: 'b', title: 'zzzz', tags: [] });
    const r = relatedKnowledge(cur, [cur, other], NOW);
    expect(r.items).toEqual([]);
    expect(r.moreCount).toBe(0);
  });

  it('自分自身は隣に出さない', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書' });
    const r = relatedKnowledge(cur, [cur], NOW);
    expect(r.items.map(i => i.id)).not.toContain('a');
  });

  it('別のペルソナの資料は混ぜない', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書', personaId: 'ceo' });
    const other = item({ id: 'b', title: '徳島の農園との打ち合わせ', personaId: 'cfo' });
    const r = relatedKnowledge(cur, [cur, other], NOW);
    expect(r.items).toEqual([]);
  });

  it('見出しも本文も無いものは、何とでも当たるので出さない', () => {
    const cur = item({ id: 'a', title: '', content: '' });
    const other = item({ id: 'b', title: '徳島の農園' });
    const r = relatedKnowledge(cur, [cur, other], NOW);
    expect(r.items).toEqual([]);
  });

  it('枠に入りきらなかったぶんは黙って切らず「ほかに◯件」として数で残る', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書' });
    const others = Array.from({ length: 7 }, (_, i) =>
      item({ id: `b${i}`, title: `徳島の農園との契約書 ${i}` }),
    );
    const r = relatedKnowledge(cur, [cur, ...others], NOW, 3);
    expect(r.items).toHaveLength(3);
    expect(r.moreCount).toBe(4);
    expect(r.items.length + r.moreCount).toBe(7);
  });

  it('3枠のうち1枠は「古い方」に予約される（直近だけで埋め尽くさない）', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書' });
    const recents = Array.from({ length: 5 }, (_, i) =>
      item({ id: `r${i}`, title: '徳島の農園との契約書', createdAt: daysAgo(i + 1) }),
    );
    // 直近より当たりは弱いが、200日前の資料
    const old = item({ id: 'old', title: '徳島の農園', createdAt: daysAgo(200) });
    const r = relatedKnowledge(cur, [cur, ...recents, old], NOW, 3);
    expect(r.items.map(i => i.id)).toContain('old');
    expect(r.oldSlotId).toBe('old');
    expect(new Set(r.items.map(i => i.id)).size).toBe(3); // 重複しない
  });

  it('古いものが無ければ枠を空けず、普通に上位で埋める', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書' });
    const recents = Array.from({ length: 4 }, (_, i) =>
      item({ id: `r${i}`, title: '徳島の農園との契約書', createdAt: daysAgo(i + 1) }),
    );
    const r = relatedKnowledge(cur, [cur, ...recents], NOW, 3);
    expect(r.items).toHaveLength(3);
    expect(r.oldSlotId).toBeNull();
  });

  it('もともと古いものが上位に入っていれば、席を二重に譲らない', () => {
    const cur = item({ id: 'a', title: '徳島の農園との契約書' });
    const old1 = item({ id: 'old1', title: '徳島の農園との契約書', createdAt: daysAgo(120) });
    const old2 = item({ id: 'old2', title: '徳島の農園', createdAt: daysAgo(400) });
    const r = relatedKnowledge(cur, [cur, old1, old2], NOW, 3);
    expect(r.oldSlotId).toBe('old1');
    expect(new Set(r.items.map(i => i.id)).size).toBe(r.items.length);
  });
});

describe('agoLabel — 数字より「時間が経った感じ」', () => {
  it('90日より新しいものには古さを名乗らせない', () => {
    expect(agoLabel(daysAgo(1), NOW)).toBeNull();
    expect(agoLabel(daysAgo(OLD_SLOT_MIN_DAYS - 1), NOW)).toBeNull();
  });

  it('半年ぶんは「半年前のあなた」', () => {
    expect(agoLabel(daysAgo(180), NOW)).toBe('半年前のあなた');
  });

  it('90日〜1年未満は「◯か月前のあなた」', () => {
    expect(agoLabel(daysAgo(95), NOW)).toBe('3か月前のあなた');
    expect(agoLabel(daysAgo(300), NOW)).toBe('10か月前のあなた');
  });

  it('1年以上は「◯年前のあなた」', () => {
    expect(agoLabel(daysAgo(400), NOW)).toBe('1年前のあなた');
    expect(agoLabel(daysAgo(800), NOW)).toBe('2年前のあなた');
  });

  it('未来の日付・壊れた日付で嘘の古さを名乗らない', () => {
    expect(agoLabel(new Date(NOW.getTime() + 86_400_000).toISOString(), NOW)).toBeNull();
    expect(agoLabel('こわれた日付', NOW)).toBeNull();
    expect(ageInDays('こわれた日付', NOW)).toBe(0);
  });
});

describe('queryFromItem — 開いている資料そのものが問い合わせ文', () => {
  it('見出し・タグ・要約・重要ポイント・本文の頭を混ぜる', () => {
    const q = queryFromItem(item({
      id: 'a',
      title: '徳島の農園',
      tags: ['契約'],
      content: 'あ'.repeat(1000),
      analysis: {
        summary: '来期の値上げ', insights: ['単価が上がる'],
        strategy: [], actions: [], risks: [], generatedAt: NOW.toISOString(),
      },
    }));
    expect(q).toContain('徳島の農園');
    expect(q).toContain('契約');
    expect(q).toContain('来期の値上げ');
    expect(q).toContain('単価が上がる');
    // 全文は渡さない（ありふれた言葉だけで何にでも当たるため）
    expect(q.length).toBeLessThan(600);
  });
});
