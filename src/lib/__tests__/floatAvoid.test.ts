// ============================================================
// floatAvoid — 「絵そのものが中身」の数え方を固定する (2026-09-03)
//
// なぜ要るか: 浮きボタンの避け方は「文字」と「押せるもの」しか数えておらず、
// サムネ・写真は覆っても費用ゼロだった。ゼロだと leastCoveringPos / liftToClear が
// 「何も覆っていない＝動かす理由がない」と判断するので、乗ったら永久にどかない。
// 実測(375px・Iris「作ったリールの棚」)＝サムネ(44x60)を 939px^2 覆い可視 64%。
// ============================================================
import { describe, it, expect } from 'vitest';
import { countsAsMedia, coverCost, liftToClear, MEDIA_MAX_VIEWPORT_RATIO } from '../floatAvoid';

const VP = { w: 375, h: 812 };
const rect = (x: number, y: number, w: number, h: number) =>
  ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h } as DOMRect);

describe('countsAsMedia — どの絵を「読むもの」として数えるか', () => {
  it('棚のサムネ(44x60)は数える', () => {
    expect(countsAsMedia({ width: 44, height: 60 }, VP)).toBe(true);
  });

  it('画面いっぱいの背景画像は数えない（避けようがないので追いやるだけ）', () => {
    expect(countsAsMedia({ width: 375, height: 812 }, VP)).toBe(false);
  });

  it('上限ちょうど(画面の25%)は数え、少し超えたら数えない', () => {
    const area = VP.w * VP.h * MEDIA_MAX_VIEWPORT_RATIO;
    const side = Math.sqrt(area);
    expect(countsAsMedia({ width: side, height: side }, VP)).toBe(true);
    expect(countsAsMedia({ width: side * 1.02, height: side * 1.02 }, VP)).toBe(false);
  });

  it('線のように細い飾り(8px以下)は数えない', () => {
    expect(countsAsMedia({ width: 300, height: 4 }, VP)).toBe(false);
    expect(countsAsMedia({ width: 4, height: 300 }, VP)).toBe(false);
  });

  it('画面の大きさが取れない時は数えない（0除算で全部を「数える」側に倒さない）', () => {
    expect(countsAsMedia({ width: 44, height: 60 }, { w: 0, h: 0 })).toBe(false);
  });
});

describe('絵を覆う費用', () => {
  it('サムネに乗ったら費用が 0 でなくなる（＝どく理由が生まれる）', () => {
    const thumb = [{ r: rect(45, 400, 44, 60), control: false }];
    expect(coverCost({ x: 14, y: 380, w: 52, h: 52 }, thumb)).toBeGreaterThan(0);
  });

  it('絵は文字と同じ重み＝押せるものより桁違いに軽い', () => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    const media = coverCost(box, [{ r: rect(0, 0, 10, 10), control: false }]);
    const control = coverCost(box, [{ r: rect(0, 0, 10, 10), control: true }]);
    expect(control).toBeGreaterThan(media * 100);
  });

  it('離れていれば費用ゼロのまま（無関係な絵で動かさない）', () => {
    const thumb = [{ r: rect(200, 400, 44, 60), control: false }];
    expect(coverCost({ x: 14, y: 400, w: 52, h: 52 }, thumb)).toBe(0);
  });
});

describe('liftToClear — 絵を数えると実際に逃げる', () => {
  it('サムネの上に居るボタンは、絵を数えれば持ち上がる', () => {
    const thumb = { r: rect(14, 600, 44, 60), control: false };
    const lift = liftToClear(
      { x: 14, w: 52, h: 52 }, 620, [thumb], { minTop: 120, currentLift: 0 },
    );
    expect(lift).toBeGreaterThan(0);
    expect(coverCost({ x: 14, y: 620 - lift, w: 52, h: 52 }, [thumb])).toBe(0);
  });

  it('何も覆っていなければ動かさない（読んでいる最中に飛び回らせない）', () => {
    const thumb = { r: rect(300, 100, 44, 60), control: false };
    expect(liftToClear({ x: 14, w: 52, h: 52 }, 620, [thumb], { minTop: 120, currentLift: 0 })).toBe(0);
  });
});
