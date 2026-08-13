import { describe, it, expect, beforeEach } from 'vitest';
import {
  swapScheduledSlots, restoreSlots, isMovableStatus,
  readQueue, writeQueue, applySlotSwap, applySlotRestore,
} from '../gridReorder';

// ============================================================
// gridReorder — 並びの中で入れ替えても「枠（時刻）」しか動かないことの固定
//
// なぜこのテストが要るか:
//   ここは「入れ替えたつもりが本文まで入れ替わっていた」「投稿済みが動いた」
//   「保存できていないのに入れ替えたと言った」が起きると、
//   画面の上ではきれいに見えるのに、実際に出る投稿が別物になる種類の壊れ方をする。
// ============================================================

const QUEUE_KEY = 'iris_post_queue_v1';

// 最小の localStorage（テストは node 環境で走るため）
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
};
(globalThis as any).window = globalThis;
if (typeof (globalThis as any).dispatchEvent !== 'function') {
  (globalThis as any).dispatchEvent = () => true;
}

const NOW = new Date('2026-08-14T03:00:00Z').getTime();

function q(id: string, status: string, at: string, extra: Record<string, unknown> = {}) {
  return { id, status, scheduledAt: at, createdAt: at, caption: `本文-${id}`, thumbDataUrl: `data:${id}`, ...extra };
}

describe('swapScheduledSlots', () => {
  it('枠（時刻）だけを入れ替え、中身は 1 文字も動かさない', () => {
    const list = [
      q('a', 'scheduled', '2026-08-20T00:00:00Z'),
      q('b', 'scheduled', '2026-08-25T00:00:00Z'),
    ];
    const res = swapScheduledSlots(list, 'a', 'b', NOW)!;
    expect(res).not.toBeNull();
    const a = res.next.find((p) => p.id === 'a')!;
    const b = res.next.find((p) => p.id === 'b')!;
    expect(a.scheduledAt).toBe('2026-08-25T00:00:00Z');
    expect(b.scheduledAt).toBe('2026-08-20T00:00:00Z');
    // 中身（本文・画像）は元のまま＝入れ替わるのは並ぶ位置だけ
    expect(a.caption).toBe('本文-a');
    expect(b.caption).toBe('本文-b');
    expect(a.thumbDataUrl).toBe('data:a');
    expect(b.thumbDataUrl).toBe('data:b');
  });

  it('元の配列を書き換えない', () => {
    const list = [q('a', 'scheduled', '2026-08-20T00:00:00Z'), q('b', 'scheduled', '2026-08-25T00:00:00Z')];
    swapScheduledSlots(list, 'a', 'b', NOW);
    expect(list[0].scheduledAt).toBe('2026-08-20T00:00:00Z');
    expect(list[1].scheduledAt).toBe('2026-08-25T00:00:00Z');
  });

  it('関係ない予約には触らない', () => {
    const list = [
      q('a', 'scheduled', '2026-08-20T00:00:00Z'),
      q('c', 'scheduled', '2026-08-22T00:00:00Z'),
      q('b', 'scheduled', '2026-08-25T00:00:00Z'),
    ];
    const res = swapScheduledSlots(list, 'a', 'b', NOW)!;
    expect(res.next.find((p) => p.id === 'c')!.scheduledAt).toBe('2026-08-22T00:00:00Z');
  });

  it('過去の枠へ移ったものは「出せる」、未来の枠へ移ったものは「時刻待ち」に付け直す', () => {
    const list = [
      q('past', 'ready', '2026-08-14T01:00:00Z'),      // すでに時刻が過ぎている枠
      q('future', 'scheduled', '2026-08-20T00:00:00Z'), // まだ先の枠
    ];
    const res = swapScheduledSlots(list, 'past', 'future', NOW)!;
    expect(res.next.find((p) => p.id === 'past')!.status).toBe('scheduled');  // 先の枠へ移った
    expect(res.next.find((p) => p.id === 'future')!.status).toBe('ready');    // 過ぎた枠へ移った
  });

  it('投稿済み・下書き・見送りは動かせない（過去と、出す約束をしていないもの）', () => {
    const list = [
      q('sched', 'scheduled', '2026-08-20T00:00:00Z'),
      q('posted', 'posted', '2026-08-10T00:00:00Z'),
      q('draft', 'draft', '2026-08-21T00:00:00Z'),
      q('skip', 'skipped', '2026-08-22T00:00:00Z'),
    ];
    expect(swapScheduledSlots(list, 'sched', 'posted', NOW)).toBeNull();
    expect(swapScheduledSlots(list, 'sched', 'draft', NOW)).toBeNull();
    expect(swapScheduledSlots(list, 'sched', 'skip', NOW)).toBeNull();
    expect(isMovableStatus('posted')).toBe(false);
    expect(isMovableStatus('ready')).toBe(true);
  });

  it('同じもの・居ないもの・時刻が読めないもの・同じ時刻は何もしない', () => {
    const list = [
      q('a', 'scheduled', '2026-08-20T00:00:00Z'),
      q('b', 'scheduled', '2026-08-20T00:00:00Z'), // まったく同じ時刻
      q('bad', 'scheduled', 'これは日付ではない'),
    ];
    expect(swapScheduledSlots(list, 'a', 'a', NOW)).toBeNull();
    expect(swapScheduledSlots(list, 'a', 'nope', NOW)).toBeNull();
    expect(swapScheduledSlots(list, 'a', 'bad', NOW)).toBeNull();
    expect(swapScheduledSlots(list, 'a', 'b', NOW)).toBeNull();
  });
});

describe('restoreSlots（元に戻す）', () => {
  it('入れ替え前の時刻と状態をそのまま書き戻す', () => {
    const list = [q('a', 'scheduled', '2026-08-20T00:00:00Z'), q('b', 'ready', '2026-08-14T01:00:00Z')];
    const res = swapScheduledSlots(list, 'a', 'b', NOW)!;
    const back = restoreSlots(res.next, res.before);
    expect(back.find((p) => p.id === 'a')!.scheduledAt).toBe('2026-08-20T00:00:00Z');
    expect(back.find((p) => p.id === 'a')!.status).toBe('scheduled');
    expect(back.find((p) => p.id === 'b')!.scheduledAt).toBe('2026-08-14T01:00:00Z');
    expect(back.find((p) => p.id === 'b')!.status).toBe('ready');
  });

  it('戻す相手が消えていても、残っている方だけ静かに戻す', () => {
    const list = [q('a', 'scheduled', '2026-08-25T00:00:00Z')];
    const back = restoreSlots(list, [
      { id: 'a', scheduledAt: '2026-08-20T00:00:00Z', status: 'scheduled' },
      { id: 'gone', scheduledAt: '2026-08-25T00:00:00Z', status: 'scheduled' },
    ]);
    expect(back).toHaveLength(1);
    expect(back[0].scheduledAt).toBe('2026-08-20T00:00:00Z');
  });
});

describe('予約リストそのものに書く（並び用のコピーを持たない）', () => {
  beforeEach(() => { localStorage.removeItem(QUEUE_KEY); });

  it('入れ替えた結果が予約リストの本体に入る', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('a', 'scheduled', '2026-08-20T00:00:00Z'),
      q('b', 'scheduled', '2026-08-25T00:00:00Z'),
    ]));
    const out = applySlotSwap('a', 'b', NOW);
    expect(out.ok).toBe(true);
    const saved = readQueue();
    expect(saved.find((p: any) => p.id === 'a')!.scheduledAt).toBe('2026-08-25T00:00:00Z');
    expect(saved.find((p: any) => p.id === 'b')!.scheduledAt).toBe('2026-08-20T00:00:00Z');

    // 元に戻すも本体に効く
    expect(applySlotRestore((out as any).before)).toBe(true);
    const back = readQueue();
    expect(back.find((p: any) => p.id === 'a')!.scheduledAt).toBe('2026-08-20T00:00:00Z');
  });

  it('入れ替えられない組み合わせは保存に行かない', () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([q('a', 'scheduled', '2026-08-20T00:00:00Z')]));
    const out = applySlotSwap('a', 'nope', NOW);
    expect(out).toEqual({ ok: false, reason: 'not-swappable' });
  });

  it('保存に失敗したら false（成功と言わせない）', () => {
    const realSet = (globalThis as any).localStorage.setItem;
    localStorage.setItem(QUEUE_KEY, JSON.stringify([
      q('a', 'scheduled', '2026-08-20T00:00:00Z'),
      q('b', 'scheduled', '2026-08-25T00:00:00Z'),
    ]));
    (globalThis as any).localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
    try {
      expect(applySlotSwap('a', 'b', NOW)).toEqual({ ok: false, reason: 'save-failed' });
      expect(writeQueue([])).toBe(false);
    } finally {
      (globalThis as any).localStorage.setItem = realSet;
    }
    // 失敗したので本体は元のまま
    expect(readQueue().find((p: any) => p.id === 'a')!.scheduledAt).toBe('2026-08-20T00:00:00Z');
  });

  it('壊れた保存は無いものとして扱う', () => {
    localStorage.setItem(QUEUE_KEY, '{壊れている');
    expect(readQueue()).toEqual([]);
  });
});
