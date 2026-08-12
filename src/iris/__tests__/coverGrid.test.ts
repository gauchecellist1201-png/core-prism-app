import { describe, it, expect, beforeEach } from 'vitest';
import { loadPostedGrid, loadPlannedGrid, plannedDateLabel, gridLegibility, cropNote } from '../coverGrid';

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

// ============================================================
// loadPlannedGrid — 「これから出る予約ぶん」を並びに入れる
//
// なぜこのテストが要るか:
//   ここで下書きや画像の無い予約まで並べてしまうと、
//   「来週こう並びます」と言いながら、出るかどうか分からないものを見せることになる。
//   出す約束をした（時刻がある）ものだけが、その時刻の順に並ぶことを振る舞いで固定する。
// ============================================================
describe('loadPlannedGrid', () => {
  beforeEach(() => {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  });

  it('1件も無ければ空（架空の枠を並べない）', () => {
    expect(loadPlannedGrid()).toEqual({ tiles: [], withoutImage: 0 });
  });

  it('scheduled と ready だけ入れる（下書き・投稿済み・見送りは入れない）', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('s', 'scheduled', '2026-08-20T00:00:00Z', 'data:1'),
      q('r', 'ready', '2026-08-19T00:00:00Z', 'data:2'),
      q('d', 'draft', '2026-08-21T00:00:00Z', 'data:3'),
      q('p', 'posted', '2026-08-18T00:00:00Z', 'data:4'),
      q('k', 'skipped', '2026-08-22T00:00:00Z', 'data:5'),
    ]));
    expect(loadPlannedGrid().tiles.map((t) => t.id)).toEqual(['s', 'r']);
  });

  it('いちばん先の予約が左上（新しい順）・上限まで', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('near', 'scheduled', '2026-08-13T00:00:00Z', 'data:1'),
      q('far', 'scheduled', '2026-08-30T00:00:00Z', 'data:2'),
      q('mid', 'scheduled', '2026-08-20T00:00:00Z', 'data:3'),
    ]));
    expect(loadPlannedGrid().tiles.map((t) => t.id)).toEqual(['far', 'mid', 'near']);
    expect(loadPlannedGrid(2).tiles.map((t) => t.id)).toEqual(['far', 'mid']);
  });

  it('画像がまだ無い予約は並べず、件数だけ返す', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('withImg', 'scheduled', '2026-08-20T00:00:00Z', 'data:1'),
      q('noImg1', 'scheduled', '2026-08-21T00:00:00Z'),
      q('noImg2', 'ready', '2026-08-22T00:00:00Z'),
    ]));
    const r = loadPlannedGrid();
    expect(r.tiles.map((t) => t.id)).toEqual(['withImg']);
    expect(r.withoutImage).toBe(2);
  });

  it('予約時刻が読めないものは出さない（いつ並ぶか言えないため）', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      { id: 'x', status: 'scheduled', scheduledAt: 'めちゃくちゃ', createdAt: '2026-08-01T00:00:00Z', thumbDataUrl: 'data:1' },
    ]));
    expect(loadPlannedGrid().tiles).toEqual([]);
  });

  it('予約ぶんには planned 印が付く（マスの日付を出す判定に使う）', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([q('s', 'scheduled', '2026-08-20T00:00:00Z', 'data:1')]));
    expect(loadPlannedGrid().tiles[0].planned).toBe(true);
    localStorage.setItem(QUEUE_KEY, JSON.stringify([q('p', 'posted', '2026-08-01T00:00:00Z', 'data:1')]));
    expect(loadPostedGrid()[0].planned).toBeUndefined();
  });

  it('同じ画像は1回だけ（並びが水増しされない）', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('a', 'scheduled', '2026-08-20T00:00:00Z', 'data:same'),
      q('b', 'scheduled', '2026-08-21T00:00:00Z', 'data:same'),
    ]));
    expect(loadPlannedGrid().tiles).toHaveLength(1);
  });

  it('保存が壊れていても落ちない', () => {
    localStorage.setItem(QUEUE_KEY, '{壊れた');
    expect(loadPlannedGrid()).toEqual({ tiles: [], withoutImage: 0 });
  });
});

describe('plannedDateLabel', () => {
  it('日付だけを出す（年も時刻も出さない）', () => {
    expect(plannedDateLabel(new Date(2026, 7, 12, 20, 0).getTime())).toBe('8/12');
    expect(plannedDateLabel(new Date(2026, 0, 3, 7, 30).getTime())).toBe('1/3');
  });
  it('読めない時刻は空（画面に NaN を出さない）', () => {
    expect(plannedDateLabel(0)).toBe('');
    expect(plannedDateLabel(NaN)).toBe('');
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
