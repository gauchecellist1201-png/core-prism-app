import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadInspirations, saveInspirations, addInspiration, removeInspiration,
  splitNoteAndUrl, safeUrl, inspirationLabel, inspirationSeed, savedAtLabel,
  INSPIRATION_NOTE_MAX, INSPIRATION_MAX, type InspirationItem,
} from '../inspirationStash';

// ============================================================
// inspirationStash — 「夜中に見つけた参考が、朝には消えている」を止める棚
//
// なぜこのテストが要るか:
//   ここは AI を一切呼ばない代わりに、**置いたものが本当に残る**ことだけが価値。
//   加えて、他人の投稿の中身を溜め込む器にしない (ひとことと URL だけ)・
//   リンクとして描くので危険な URL を通さない、という 2 つの約束を固定する。
// ============================================================

function fakeStorage(opts: { failWrite?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.failWrite) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
    _map: map,
  } as unknown as Storage & { _map: Map<string, string> };
}

const g = globalThis as { localStorage?: Storage };
let saved: Storage | undefined;

beforeEach(() => { saved = g.localStorage; g.localStorage = fakeStorage(); });
afterEach(() => { g.localStorage = saved; });

describe('splitNoteAndUrl — 自分のひとことと URL だけに分ける', () => {
  it('文の中の URL を 1 つ拾い、残りをひとことにする', () => {
    expect(splitNoteAndUrl('この間の演出が好き https://example.com/reel/1 参考に'))
      .toEqual({ note: 'この間の演出が好き 参考に', url: 'https://example.com/reel/1' });
  });

  it('URL が先頭でも同じ形に落ちる', () => {
    expect(splitNoteAndUrl('https://example.com/a あとで見る'))
      .toEqual({ note: 'あとで見る', url: 'https://example.com/a' });
  });

  it('URL だけでも置ける (ひとことは空)', () => {
    expect(splitNoteAndUrl('https://example.com/a')).toEqual({ note: '', url: 'https://example.com/a' });
  });

  it('2 つ目以降の URL はひとことの一部として残す (拾うのは 1 つだけ)', () => {
    const r = splitNoteAndUrl('https://a.example/1 と https://b.example/2');
    expect(r.url).toBe('https://a.example/1');
    expect(r.note).toContain('https://b.example/2');
  });

  it('ひとことは 140 字で止める — 人のキャプションを丸ごと溜める器にしない', () => {
    const r = splitNoteAndUrl('あ'.repeat(400));
    expect(r.note).toHaveLength(INSPIRATION_NOTE_MAX);
  });

  it('空・空白だけなら何も残らない', () => {
    expect(splitNoteAndUrl('   \n  ')).toEqual({ note: '' });
  });
});

describe('safeUrl — リンクとして描いてよいものだけ通す', () => {
  it('http / https は通す', () => {
    expect(safeUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(safeUrl('http://example.com/x')).toBe('http://example.com/x');
  });

  it('javascript: や data: は通さない (棚の行はリンクとして描かれる)', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,<script>')).toBeUndefined();
    expect(safeUrl('ただの文字列')).toBeUndefined();
  });
});

describe('addInspiration — 置いたものが残る', () => {
  it('置いた直後に読み直しても在る (新しい順)', () => {
    addInspiration('ひとつめ', new Date('2026-09-01T10:00:00Z'));
    addInspiration('ふたつめ', new Date('2026-09-02T10:00:00Z'));
    const list = loadInspirations();
    expect(list.map(i => i.note)).toEqual(['ふたつめ', 'ひとつめ']);
  });

  it('空欄では何も置かず null を返す = 呼び手が「置きました」と嘘をつけない', () => {
    expect(addInspiration('   ')).toBeNull();
    expect(loadInspirations()).toHaveLength(0);
  });

  it('同じひとこと＋同じ URL は増やさない', () => {
    const first = addInspiration('同じやつ https://example.com/a');
    expect(first).toHaveLength(1);
    expect(addInspiration('同じやつ https://example.com/a')).toBeNull();
    expect(loadInspirations()).toHaveLength(1);
  });

  it('ひとことが同じでも URL が違えば別の 1 件として置ける', () => {
    addInspiration('この演出 https://example.com/a');
    addInspiration('この演出 https://example.com/b');
    expect(loadInspirations()).toHaveLength(2);
  });

  it('上限を超えたら古いものから落ちる (棚が無限に伸びない)', () => {
    for (let i = 0; i < INSPIRATION_MAX + 5; i++) addInspiration(`メモ${i}`);
    const list = loadInspirations();
    expect(list).toHaveLength(INSPIRATION_MAX);
    expect(list[0].note).toBe(`メモ${INSPIRATION_MAX + 4}`); // 最新が先頭
    expect(list.some(i => i.note === 'メモ0')).toBe(false);  // いちばん古いのは落ちた
  });

  it('保存できない端末 (プライベートモード等) でも投げない', () => {
    g.localStorage = fakeStorage({ failWrite: true });
    expect(() => addInspiration('置けない端末')).not.toThrow();
    expect(loadInspirations()).toHaveLength(0);
  });
});

describe('removeInspiration — 捨てる道がある', () => {
  it('指定した 1 件だけ消える', () => {
    addInspiration('のこす');
    const list = addInspiration('けす')!;
    const target = list.find(i => i.note === 'けす')!;
    const next = removeInspiration(target.id);
    expect(next.map(i => i.note)).toEqual(['のこす']);
    expect(loadInspirations().map(i => i.note)).toEqual(['のこす']);
  });

  it('無い id を渡しても他を巻き込まない', () => {
    addInspiration('のこす');
    expect(removeInspiration('i_nothing')).toHaveLength(1);
  });
});

describe('loadInspirations — 壊れた保存データで嘘の在庫を見せない', () => {
  it('JSON が壊れていれば空で返す', () => {
    g.localStorage!.setItem('core_iris_inspiration_v1', '{壊れている');
    expect(loadInspirations()).toEqual([]);
  });

  it('配列でなければ空で返す', () => {
    g.localStorage!.setItem('core_iris_inspiration_v1', '{"a":1}');
    expect(loadInspirations()).toEqual([]);
  });

  it('中身の無い行・形の違う行は在庫にしない', () => {
    g.localStorage!.setItem('core_iris_inspiration_v1', JSON.stringify([
      { id: 'a', note: '', createdAt: '2026-09-01T00:00:00.000Z' }, // 中身なし
      null,
      'ただの文字列',
      { id: 'b', note: 'これは残る', createdAt: '2026-09-01T00:00:00.000Z' },
    ]));
    expect(loadInspirations().map(i => i.note)).toEqual(['これは残る']);
  });

  it('保存データに紛れ込んだ危険な URL は落とす (書き込み時だけでなく読み出し時も)', () => {
    g.localStorage!.setItem('core_iris_inspiration_v1', JSON.stringify([
      { id: 'a', note: 'メモ', url: 'javascript:alert(1)', createdAt: '2026-09-01T00:00:00.000Z' },
    ]));
    expect(loadInspirations()[0].url).toBeUndefined();
  });
});

describe('見せ方 — 名前と日付', () => {
  it('ひとことが無ければ URL のドメインを見出しにする', () => {
    const item: InspirationItem = { id: 'x', note: '', url: 'https://www.instagram.com/reel/abc', createdAt: '' };
    expect(inspirationLabel(item)).toBe('instagram.com');
  });

  it('下敷きに渡すのはひとことだけ (URL は台本のテーマに混ぜない)', () => {
    const list = addInspiration('朝のルーティン https://example.com/a')!;
    expect(inspirationSeed(list[0])).toBe('朝のルーティン');
  });

  it('今日 / 昨日 / 日付', () => {
    const now = new Date('2026-09-06T09:00:00');
    expect(savedAtLabel(new Date('2026-09-06T01:00:00').toISOString(), now)).toBe('今日');
    expect(savedAtLabel(new Date('2026-09-05T23:00:00').toISOString(), now)).toBe('昨日');
    expect(savedAtLabel(new Date('2026-09-02T12:00:00').toISOString(), now)).toBe('9月2日');
  });

  it('壊れた日付では日付欄を出さない (「Invalid Date」を人に見せない)', () => {
    expect(savedAtLabel('こわれている')).toBe('');
  });
});

describe('保存の副作用', () => {
  it('saveInspirations は渡した配列を書き換えない', () => {
    const list: InspirationItem[] = [{ id: 'a', note: 'x', createdAt: '2026-09-01T00:00:00.000Z' }];
    const copy = JSON.parse(JSON.stringify(list));
    saveInspirations(list);
    expect(list).toEqual(copy);
  });
});
