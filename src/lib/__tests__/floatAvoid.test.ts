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

// ============================================================
// bandHasContent — 「帯」と「飾り」を見分ける (2026-09-04)
//
// なぜ要るか: Iris ホームには z-index:0 / pointer-events:none の 320x320 の
// ぼかし玉(背景の光)が fixed で置かれており、画面幅の 60% を超えるため
// **下部バーとして数えられていた**(実測 375x812: bottom=400px)。
// 可動域が 207px しか残らず、画面いっぱいの入力欄(x39..335)を避けられる場所が
// 1つも無くなり、丸ボタンが入力欄の角に 373px^2 乗ったまま動けなくなっていた。
// ============================================================
import { bandHasContent, BAND_CONTENT_SELECTOR } from '../floatAvoid';

/** querySelector だけを持つ最小の偽要素(この判定は DOM に依存しない) */
const fakeEl = (textContent: string, matches: string[] = []) => ({
  textContent,
  querySelector: (sel: string) =>
    sel === BAND_CONTENT_SELECTOR && matches.length ? ({ tag: matches[0] } as unknown) : null,
});

describe('bandHasContent — 中身の無い箱は帯として数えない', () => {
  it('文字を持つ下部ドック(「企画」「その他」)は帯として数える', () => {
    expect(bandHasContent(fakeEl('企画 その他'))).toBe(true);
  });

  it('文字は無いがボタンを抱えているバーは帯として数える（アイコンだけの下部バー）', () => {
    expect(bandHasContent(fakeEl('', ['button']))).toBe(true);
  });

  it('文字も押せるものも絵も無い箱は飾り＝数えない（Iris ホームのぼかし玉）', () => {
    expect(bandHasContent(fakeEl(''))).toBe(false);
  });

  it('空白だけの箱も飾り扱い（改行やスペースを「中身」と数えない）', () => {
    expect(bandHasContent(fakeEl('   \n\t '))).toBe(false);
  });

  it('textContent が null でも落ちない', () => {
    expect(bandHasContent({ textContent: null })).toBe(false);
  });

  it('querySelector を持たないものでも落ちない（文字だけで判定する）', () => {
    expect(bandHasContent({ textContent: 'ドック' })).toBe(true);
  });

  it('外枠が pointer-events:none でも、中に押せるものがあれば帯（Prism の下部バー）', () => {
    // pointer-events では弾かない、という 2026-07-27 の約束をこの判定でも守る
    expect(bandHasContent(fakeEl('', ['a']))).toBe(true);
  });

  it('探す対象には絵(img/video/canvas/svg)も入っている＝絵だけのバーも見失わない', () => {
    for (const tag of ['img', 'video', 'canvas', 'svg']) {
      expect(BAND_CONTENT_SELECTOR).toContain(tag);
    }
  });
});

// ============================================================
// 属性の変化で起きる（浮きボタン同士がぶつかる根治・2026-09-05）
//
// なぜ要るか: Iris「動画おまかせ」で右下の「アイリス と話す」FAB(80x80) が
// 自分の避け計算で切替オーブ(52x52)の上へ移動してくる。オーブは FAB を
// 「押せるもの」として数えているので測り直せば必ず逃げるのに、
// **FAB が inline style で動くのは attributes の変化**で、観測が
// childList / characterData しか見ていなかったため 1 件も届いていなかった。
// 実測＝重なり 2,100px^2 のまま 7 秒待っても動かず、もう一度スクロールした
// 瞬間に 0px^2 になる（＝逃げ場が無いのではなく、起こされていない）。
//
// ただし「attributes: true」をそのまま足すと飛び回る事故になるので、
// ①拾う属性と要素を絞る（isFloatMove）②回数で必ず止まる（allowAttrWake）。
// ============================================================
import {
  isFloatMove,
  allowAttrWake,
  createAttrWakeBudget,
  ATTR_WAKE_LIMIT,
  ATTR_WAKE_WINDOW_MS,
  FLOAT_MOVE_ATTRS,
} from '../floatAvoid';

describe('isFloatMove — どの属性変化を「浮きボタンが動いた」と見なすか', () => {
  it('固定された要素の style 変化は拾う（FAB は inline style で動く）', () => {
    expect(isFloatMove('style', 'fixed')).toBe(true);
  });

  it('固定された要素の class 変化も拾う（クラスで位置を切り替える作りもある）', () => {
    expect(isFloatMove('class', 'fixed')).toBe(true);
  });

  it('本文（固定でない要素）の style 変化では起こさない＝読んでいる最中に飛ばない', () => {
    expect(isFloatMove('style', 'static')).toBe(false);
    expect(isFloatMove('style', 'relative')).toBe(false);
    expect(isFloatMove('class', 'absolute')).toBe(false);
  });

  it('追従ヘッダー(sticky)の伸縮では起こさない（帯は ResizeObserver 側の担当）', () => {
    expect(isFloatMove('style', 'sticky')).toBe(false);
  });

  it('位置と関係ない属性（aria-expanded / data-* / src）では起こさない', () => {
    expect(isFloatMove('aria-expanded', 'fixed')).toBe(false);
    expect(isFloatMove('data-state', 'fixed')).toBe(false);
    expect(isFloatMove('src', 'fixed')).toBe(false);
  });

  it('属性名が無い（null / undefined）通知で落ちない', () => {
    expect(isFloatMove(null, 'fixed')).toBe(false);
    expect(isFloatMove(undefined, 'fixed')).toBe(false);
  });

  it('観測する属性は style / class の 2 つだけに絞ってある', () => {
    expect(FLOAT_MOVE_ATTRS).toEqual(['style', 'class']);
  });
});

describe('allowAttrWake — 起こし合いが必ず有限回で止まる', () => {
  it('ふつうの 1 回（乗られたので測り直す）は通す', () => {
    const b = createAttrWakeBudget();
    expect(allowAttrWake(b, 1000)).toBe(true);
  });

  it('上限までは通す', () => {
    const b = createAttrWakeBudget();
    for (let i = 0; i < ATTR_WAKE_LIMIT; i++) {
      expect(allowAttrWake(b, 1000 + i * 100)).toBe(true);
    }
  });

  it('窓の中で上限を超えたら止まる（浮きボタン同士の起こし合いを断つ）', () => {
    const b = createAttrWakeBudget();
    for (let i = 0; i < ATTR_WAKE_LIMIT; i++) allowAttrWake(b, 1000 + i * 100);
    expect(allowAttrWake(b, 1000 + ATTR_WAKE_LIMIT * 100)).toBe(false);
  });

  it('一度止まったら、時間が経っても二度と起こさない（＝無限に飛び回らない）', () => {
    const b = createAttrWakeBudget();
    for (let i = 0; i <= ATTR_WAKE_LIMIT; i++) allowAttrWake(b, 1000 + i * 100);
    expect(b.off).toBe(true);
    // 1 時間後でも通さない。止まった後は 2026-09-04 以前と同じ挙動＝安全側。
    expect(allowAttrWake(b, 1000 + 3600_000)).toBe(false);
  });

  it('窓から外れた古い回数は数え直される（ゆっくり起きる分は止めない）', () => {
    const b = createAttrWakeBudget();
    for (let i = 0; i < ATTR_WAKE_LIMIT; i++) allowAttrWake(b, 1000 + i * 10);
    // 窓を抜けた頃なら、また 1 回目として通る
    expect(allowAttrWake(b, 1000 + ATTR_WAKE_WINDOW_MS + 1)).toBe(true);
    expect(b.off).toBe(false);
  });

  it('窓の境目ちょうど（= windowMs）は「外れた」側に数える', () => {
    const b = createAttrWakeBudget();
    for (let i = 0; i < ATTR_WAKE_LIMIT; i++) allowAttrWake(b, 1000);
    expect(allowAttrWake(b, 1000 + ATTR_WAKE_WINDOW_MS)).toBe(true);
  });

  it('新しい観測（画面を開き直した時）は止まった記憶を持ち越さない', () => {
    const b1 = createAttrWakeBudget();
    for (let i = 0; i <= ATTR_WAKE_LIMIT; i++) allowAttrWake(b1, 1000 + i * 10);
    expect(allowAttrWake(b1, 1100)).toBe(false);
    const b2 = createAttrWakeBudget();
    expect(allowAttrWake(b2, 1100)).toBe(true);
  });
});

// ============================================================
// observeContentChange の配線そのものを固定する
// （「属性を観測していない」という HEAD の穴を、この 1 ファイルで赤くできるようにする）
// 画面なしで確かめられるよう、MutationObserver / document / getComputedStyle を差し替える。
// ============================================================
import { observeContentChange } from '../floatAvoid';
import { beforeEach, afterEach, vi } from 'vitest';

type FakeEl = { nodeType: number; position: string; contains: (o: unknown) => boolean };
const fakeNode = (position = 'static'): FakeEl => {
  const el: FakeEl = { nodeType: 1, position, contains: (o) => o === el };
  return el;
};
const attrRec = (target: FakeEl, attributeName: string | null) =>
  ({ type: 'attributes', target, attributeName }) as unknown as MutationRecord;
const childRec = (target: FakeEl) =>
  ({ type: 'childList', target, attributeName: null }) as unknown as MutationRecord;

let fire: ((recs: MutationRecord[]) => void) | null = null;
let observedInit: MutationObserverInit | null = null;
let disconnected = false;
const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};

beforeEach(() => {
  for (const k of ['MutationObserver', 'document', 'getComputedStyle']) saved[k] = g[k];
  fire = null;
  observedInit = null;
  disconnected = false;
  g.MutationObserver = class {
    constructor(cbk: (recs: MutationRecord[]) => void) { fire = cbk; }
    observe(_t: unknown, init: MutationObserverInit) { observedInit = init; }
    disconnect() { disconnected = true; }
  };
  g.document = { body: {} };
  g.getComputedStyle = (el: FakeEl) => ({ position: el.position });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  for (const k of ['MutationObserver', 'document', 'getComputedStyle']) g[k] = saved[k];
});

describe('observeContentChange — 浮きボタンが動いたことに気づく', () => {
  it('属性まで観測している（HEAD は childList / characterData だけで、ここが穴だった）', () => {
    observeContentChange(() => { }, () => []);
    expect(observedInit?.attributes).toBe(true);
    expect(observedInit?.attributeFilter).toEqual(['style', 'class']);
    expect(observedInit?.childList).toBe(true);
    expect(observedInit?.subtree).toBe(true);
  });

  it('ほかの浮きボタンが inline style で動いたら測り直す（重なり 2,100px^2 の根治）', () => {
    const cb = vi.fn();
    observeContentChange(cb, () => []);
    fire!([attrRec(fakeNode('fixed'), 'style')]);
    vi.advanceTimersByTime(400);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('本文の style / class の付け替えでは測り直さない（読んでいる最中に飛ばない）', () => {
    const cb = vi.fn();
    observeContentChange(cb, () => []);
    fire!([attrRec(fakeNode('static'), 'class'), attrRec(fakeNode('relative'), 'style')]);
    vi.advanceTimersByTime(400);
    expect(cb).not.toHaveBeenCalled();
  });

  it('自分自身が動いた分は今までどおり無視する（自分の動きで自分を起こさない）', () => {
    const cb = vi.fn();
    const self = fakeNode('fixed');
    observeContentChange(cb, () => [self as unknown as Element]);
    fire!([attrRec(self, 'style')]);
    vi.advanceTimersByTime(400);
    expect(cb).not.toHaveBeenCalled();
  });

  it('中身の入れ替え（タブ切替）は今までどおり回数制限なしで測り直す', () => {
    const cb = vi.fn();
    observeContentChange(cb, () => []);
    for (let i = 0; i < 10; i++) {
      fire!([childRec(fakeNode())]);
      vi.advanceTimersByTime(400);
    }
    expect(cb).toHaveBeenCalledTimes(10);
  });

  it('浮きボタン同士が起こし合っても必ず止まる（上限を超えたら以後は起こさない）', () => {
    const cb = vi.fn();
    observeContentChange(cb, () => []);
    for (let i = 0; i < 20; i++) {
      fire!([attrRec(fakeNode('fixed'), 'style')]);
      vi.advanceTimersByTime(400); // 実際の起こし合いは debounce ぶんの間隔で来る
    }
    expect(cb.mock.calls.length).toBeLessThanOrEqual(ATTR_WAKE_LIMIT);
  });

  it('片付けたら、待っている測り直しも取り消して観測も外す', () => {
    const cb = vi.fn();
    const stop = observeContentChange(cb, () => []);
    fire!([childRec(fakeNode())]);
    stop(); // debounce の途中で画面を離れた
    vi.advanceTimersByTime(400);
    expect(cb).not.toHaveBeenCalled();
    expect(disconnected).toBe(true);
  });
});
