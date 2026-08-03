import { describe, it, expect, beforeEach } from 'vitest';
import { loadPostedGrid, gridLegibility, cropNote } from '../coverGrid';

// ============================================================
// coverGrid — 並びプレビューが「実データだけ」を新しい順で出すことの固定
//
// なぜこのテストが要るか:
//   並びプレビューは、空っぽの時に見本のダミーを出すと一瞬で嘘になる
//   （本人の並びを見るための機能なのに、他人の並びを見せることになる）。
//   「投稿済みでない」「画像が無い」ものが混ざらないこと、
//   1件も無い時に空配列になることを型ではなく振る舞いで固定する。
// ============================================================

const QUEUE_KEY = 'iris_post_queue_v1';
const HISTORY_KEY = 'core_iris_posthistory_v1';

// 最小の localStorage（テストは node 環境で走るため）
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
};
(globalThis as any).window = globalThis;

function q(id: string, status: string, at: string, thumb?: string) {
  return { id, status, scheduledAt: at, createdAt: at, caption: 'テスト', thumbDataUrl: thumb };
}

describe('loadPostedGrid', () => {
  beforeEach(() => {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  });

  it('1件も無ければ空（見本のダミーを作らない）', () => {
    expect(loadPostedGrid()).toEqual([]);
  });

  it('投稿済み以外と、画像の無いものは並べない', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('a', 'posted', '2026-08-01T00:00:00Z', 'data:image/jpeg;base64,AAA'),
      q('b', 'scheduled', '2026-08-02T00:00:00Z', 'data:image/jpeg;base64,BBB'), // まだ出していない
      q('c', 'posted', '2026-08-03T00:00:00Z'),                                  // 画像が無い
    ]));
    expect(loadPostedGrid().map((t) => t.id)).toEqual(['a']);
  });

  it('予約リストと Instagram 連携を混ぜて新しい順・上限まで', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('old', 'posted', '2026-07-01T00:00:00Z', 'data:1'),
      q('new', 'posted', '2026-08-03T00:00:00Z', 'data:2'),
    ]));
    localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: 'ig1', postedAt: '2026-08-02T00:00:00Z', thumbUrl: 'https://cdn/x.jpg', title: 'IG' },
      { id: 'ig2', postedAt: '2026-06-01T00:00:00Z' }, // サムネイル無し＝並べない
    ]));
    expect(loadPostedGrid().map((t) => t.id)).toEqual(['new', 'ig1', 'old']);
    expect(loadPostedGrid(2).map((t) => t.id)).toEqual(['new', 'ig1']);
  });

  it('同じ画像は1回だけ（連携と予約で二重に持っていても並びが水増しされない）', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([q('a', 'posted', '2026-08-01T00:00:00Z', 'data:same')]));
    localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: 'b', postedAt: '2026-08-02T00:00:00Z', thumbUrl: 'data:same' },
    ]));
    expect(loadPostedGrid()).toHaveLength(1);
  });

  it('保存が壊れていても落ちない', () => {
    localStorage.setItem(QUEUE_KEY, '{壊れた');
    expect(loadPostedGrid()).toEqual([]);
  });
});

describe('gridLegibility', () => {
  it('並びの実寸で判定する（1080px の 96px 見出しは 98px のマスで約 8.7px）', () => {
    const r = gridLegibility(96, 1080, 98);
    expect(r.effPx).toBeCloseTo(8.7, 1);
    expect(r.level).toBe('ok');
  });

  it('見出しが長くて小さくなった時は警告、極端なら「読めません」', () => {
    expect(gridLegibility(87, 1080, 98).level).toBe('warn');
    expect(gridLegibility(52, 1080, 98).level).toBe('bad');
  });

  it('測れていない時は何も言わない（推測で警告を出さない）', () => {
    expect(gridLegibility(96, 1080, 0).msg).toBe('');
  });
});

describe('cropNote', () => {
  it('4:5 はそのまま並ぶので注意書きを出さない', () => {
    expect(cropNote('4:5')).toBe('');
  });
  it('9:16 は上下が切れることを先に言う', () => {
    expect(cropNote('9:16')).toContain('上下');
  });
});
