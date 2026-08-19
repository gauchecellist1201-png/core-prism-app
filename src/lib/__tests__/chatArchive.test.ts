// ============================================================
// chatArchive — 端末引き継ぎ（T1-2c）が「静かに失敗しない」ことを固定する
//
// ここが壊れると、症状は「エラーは出ないのに、いつまでも会話が引き継がれない」
// になる（413 で毎回捨てられる / マージでこちらの最新が消える）。目視では出ない。
// ============================================================
import { describe, it, expect } from 'vitest';
import { slimChatsForCloud, mergeChats, countNewMessages, type ChatMap } from '../chatArchive';

const SERVER_MAX_BYTES = 900_000; // api/account/blob.ts の MAX_BYTES と一致

function msg(id: string, ts: number, text = 'hello') {
  return { id, kind: 'user' as const, text, ts };
}

describe('slimChatsForCloud', () => {
  it('会話が多すぎてもサーバー上限に必ず収まる（413で黙って捨てられない）', () => {
    // 20人格 × 100件 × 3KB ≒ 6MB の“ありえる最悪”を投げる
    const big: ChatMap = {};
    for (let p = 0; p < 20; p++) {
      big[`persona-${p}`] = Array.from({ length: 100 }, (_, i) => msg(`m${p}_${i}`, i, 'あ'.repeat(3000)));
    }
    const out = slimChatsForCloud(big);
    expect(JSON.stringify(out).length).toBeLessThan(SERVER_MAX_BYTES);
  });

  it('間引いても「いちばん新しい会話」が残る（古い方を残さない）', () => {
    const map: ChatMap = { p1: Array.from({ length: 100 }, (_, i) => msg(`m${i}`, i)) };
    const out = slimChatsForCloud(map);
    const ids = out.p1.map(m => m.id);
    expect(ids).toContain('m99');
    expect(ids).not.toContain('m0');
  });

  it('長すぎる1件が枠を食い潰さないよう本文を切る', () => {
    const out = slimChatsForCloud({ p1: [msg('m1', 1, 'x'.repeat(50_000))] });
    expect((out.p1[0].text || '').length).toBeLessThanOrEqual(4001);
  });
});

describe('mergeChats', () => {
  it('同じ id はローカル側が勝つ（この端末の最新が消えない）', () => {
    const local: ChatMap = { p1: [msg('a', 1, 'local')] };
    const remote: ChatMap = { p1: [msg('a', 1, 'remote')] };
    expect(mergeChats(local, remote).p1[0].text).toBe('local');
  });

  it('両方にしかない会話が時刻順に1本へ並ぶ', () => {
    const local: ChatMap = { p1: [msg('a', 1), msg('c', 3)] };
    const remote: ChatMap = { p1: [msg('b', 2)] };
    expect(mergeChats(local, remote).p1.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('リモートにしかない人格も引き継ぐ（PCで作った人格の会話が落ちない）', () => {
    const merged = mergeChats({ p1: [msg('a', 1)] }, { p2: [msg('z', 9)] });
    expect(Object.keys(merged).sort()).toEqual(['p1', 'p2']);
  });

  it('リモートが空でもローカルを消さない', () => {
    expect(mergeChats({ p1: [msg('a', 1)] }, {}).p1).toHaveLength(1);
  });
});

describe('countNewMessages', () => {
  it('増えた件数だけを数える（「N件引き継ぎました」を嘘にしない）', () => {
    const before: ChatMap = { p1: [msg('a', 1)] };
    const after: ChatMap = { p1: [msg('a', 1), msg('b', 2)], p2: [msg('z', 9)] };
    expect(countNewMessages(before, after)).toBe(2);
  });

  it('何も増えていなければ0（余計な祝いを出さない）', () => {
    const same: ChatMap = { p1: [msg('a', 1)] };
    expect(countNewMessages(same, same)).toBe(0);
  });
});
