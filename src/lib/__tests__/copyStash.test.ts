import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  COPY_STASH_MAX, COPY_STASH_MAX_TEXT, COPY_STASH_TTL_MS,
  chipLabel, clearCopies, getRecentCopies, looksSecret, normalizeCopy,
  pruneEntries, pushEntry, recordCopy, subscribeCopies,
  type CopyStashEntry,
} from '../copyStash';

const NOW = 1_757_000_000_000;
const entry = (over: Partial<CopyStashEntry> = {}): CopyStashEntry =>
  ({ id: 'a', text: 'ある文章', label: '本文', at: NOW, ...over });

describe('normalizeCopy', () => {
  it('前後の空白と改行コードを揃える', () => {
    expect(normalizeCopy('  行1\r\n行2  ')).toBe('行1\n行2');
  });
  it('長すぎるコピーは頭だけ持つ', () => {
    expect(normalizeCopy('あ'.repeat(COPY_STASH_MAX_TEXT + 500)).length).toBe(COPY_STASH_MAX_TEXT);
  });
  it('空や undefined でも落ちない', () => {
    expect(normalizeCopy('')).toBe('');
    expect(normalizeCopy(undefined as unknown as string)).toBe('');
  });
});

describe('looksSecret — 鍵は最初から取り込まない', () => {
  const secrets = [
    'sk-abcdefghijklmnopqrstuvwx',
    'rk_live_51ABCDEFGHIJKLMN',
    'sk_test_51ABCDEFGHIJKLMN',
    'AIzaSyA1234567890abcdefghijklmnop',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345',
    '-----BEGIN RSA PRIVATE KEY-----',
    'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123',
    'xoxb-1234567890-abcdefghij',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
  ];
  it.each(secrets)('拒否する: %s', s => expect(looksSecret(s)).toBe(true));

  it('ふつうの日本語メモは拒否しない', () => {
    expect(looksSecret('明日の打ち合わせは14時から。資料は前日までに送る')).toBe(false);
  });
  it('ふつうの URL は拒否しない', () => {
    expect(looksSecret('https://core-prism-app.vercel.app/prism')).toBe(false);
  });
  it('鍵が本文のどこかに混ざっていても、その1件ごと取り込まない', () => {
    const list = pushEntry([], '接続情報です\nrk_live_51ABCDEFGHIJKLMN\nよろしく', '本文', NOW, 'x');
    expect(list).toEqual([]);
  });
});

describe('pushEntry', () => {
  it('先頭に足す', () => {
    const list = pushEntry([entry({ id: 'old', text: '古い' })], '新しい文章', '本文', NOW, 'new');
    expect(list.map(e => e.text)).toEqual(['新しい文章', '古い']);
  });

  it('短すぎるもの・空は取り込まず、渡された配列をそのまま返す（何も起きていないと分かるように）', () => {
    const before: CopyStashEntry[] = [entry()];
    expect(pushEntry(before, 'あ', '', NOW, 'x')).toBe(before);
    expect(pushEntry(before, '   ', '', NOW, 'x')).toBe(before);
  });

  it('同じ本文は増やさず、先頭へ上げて時刻を更新する', () => {
    const before = [entry({ id: 'a', text: '文章A' }), entry({ id: 'b', text: '文章B' })];
    const after = pushEntry(before, '文章B', '本文', NOW + 5000, 'b2');
    expect(after.map(e => e.text)).toEqual(['文章B', '文章A']);
    expect(after).toHaveLength(2);
    expect(after[0].at).toBe(NOW + 5000);
  });

  it('前後の空白だけ違うコピーも同じ1件として扱う', () => {
    const after = pushEntry([entry({ text: 'ある文章' })], '  ある文章 \n', '本文', NOW, 'x');
    expect(after).toHaveLength(1);
  });

  it('上限を超えたら古いものから捨てる', () => {
    let list: CopyStashEntry[] = [];
    for (let i = 0; i < COPY_STASH_MAX + 3; i++) list = pushEntry(list, `文章${i}`, '本文', NOW + i, `id${i}`);
    expect(list).toHaveLength(COPY_STASH_MAX);
    expect(list[0].text).toBe(`文章${COPY_STASH_MAX + 2}`);
    expect(list.some(e => e.text === '文章0')).toBe(false);
  });
});

describe('pruneEntries — 期限つき', () => {
  it('30分を過ぎたものは落ちる', () => {
    const list = [entry({ id: 'old', at: NOW - COPY_STASH_TTL_MS - 1 }), entry({ id: 'new', at: NOW })];
    expect(pruneEntries(list, NOW).map(e => e.id)).toEqual(['new']);
  });
  it('落とすものが無ければ同じ配列を返す', () => {
    const list = [entry()];
    expect(pruneEntries(list, NOW + 1000)).toBe(list);
  });
});

describe('chipLabel', () => {
  it('改行と連続空白を1行につぶす', () => {
    expect(chipLabel(entry({ text: '1行目\n\n  2行目' }))).toBe('1行目 2行目');
  });
  it('長い本文は … で切る', () => {
    expect(chipLabel(entry({ text: 'あ'.repeat(50) }), 10)).toBe('あ'.repeat(10) + '…');
  });
});

describe('実行時の入れ物（保存しない・通知する）', () => {
  beforeEach(() => { clearCopies(); vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); clearCopies(); });

  it('コピーを控えると購読者に届く', () => {
    const seen = vi.fn();
    const off = subscribeCopies(seen);
    recordCopy('会議メモ: 見積は金曜まで', '本文');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getRecentCopies().map(e => e.text)).toEqual(['会議メモ: 見積は金曜まで']);
    off();
  });

  it('取り込まなかった時は誰にも通知しない（空・鍵）', () => {
    const seen = vi.fn();
    const off = subscribeCopies(seen);
    recordCopy('', '本文');
    recordCopy('sk-abcdefghijklmnopqrstuvwx', '本文');
    expect(seen).not.toHaveBeenCalled();
    expect(getRecentCopies()).toEqual([]);
    off();
  });

  it('30分たつと候補から消える', () => {
    recordCopy('古いコピー', '本文');
    vi.setSystemTime(NOW + COPY_STASH_TTL_MS + 1);
    expect(getRecentCopies()).toEqual([]);
  });

  it('購読をやめた後は届かない', () => {
    const seen = vi.fn();
    subscribeCopies(seen)();
    recordCopy('あとから来たコピー', '本文');
    expect(seen).not.toHaveBeenCalled();
  });

  it('1人の購読者が落ちても他へ届く', () => {
    const ok = vi.fn();
    const off1 = subscribeCopies(() => { throw new Error('落ちた'); });
    const off2 = subscribeCopies(ok);
    expect(() => recordCopy('壊れても届く', '本文')).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
    off1(); off2();
  });

  it('どこにも保存しない（localStorage を1度も触らない）', () => {
    const store = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', store);
    recordCopy('保存されてはいけないメモ', '本文');
    getRecentCopies();
    expect(store.setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
