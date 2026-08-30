import { describe, it, expect } from 'vitest';
import {
  reelEditChanged, undoLabelFromSummaries, UNDO_LABEL_MAX,
  type UndoComparableState,
} from '../reelUndo';

const clip = (id: string, duration = 3, extra: Record<string, unknown> = {}) =>
  ({ id, duration, ...extra });

const state = (clips: ReturnType<typeof clip>[], presetId: string | null = null, colorMood = 'none'): UndoComparableState =>
  ({ clips, presetId, colorMood });

describe('戻す価値があるか (reelEditChanged)', () => {
  it('何も変わっていなければ「元に戻す」を出さない', () => {
    const a = state([clip('a'), clip('b')], 'warm', 'film');
    const b = state([clip('a'), clip('b')], 'warm', 'film');
    expect(reelEditChanged(a, b)).toBe(false);
  });

  it('カットが 1 枚消えたら戻せる (言い間違いでいちばん起きる事故)', () => {
    const before = state([clip('a'), clip('b'), clip('c')]);
    const after = state([clip('a'), clip('c')]);
    expect(reelEditChanged(before, after)).toBe(true);
  });

  it('並べ替えただけでも戻せる (枚数は同じでも順番が違う)', () => {
    const before = state([clip('a'), clip('b'), clip('c')]);
    const after = state([clip('b'), clip('a'), clip('c')]);
    expect(reelEditChanged(before, after)).toBe(true);
  });

  it('尺が変わったら戻せる', () => {
    expect(reelEditChanged(state([clip('a', 3)]), state([clip('a', 5)]))).toBe(true);
  });

  it('秒数の浮動小数の誤差は「変わった」にしない (押しても何も起きないボタンを作らない)', () => {
    const before = state([clip('a', 15 / 3)]);
    const after = state([clip('a', 5.0000001)]);
    expect(reelEditChanged(before, after)).toBe(false);
  });

  it('字幕の文言が変わったら戻せる', () => {
    const before = state([clip('a', 3, { captionText: '朝のルーティン' })]);
    const after = state([clip('a', 3, { captionText: '夜のルーティン' })]);
    expect(reelEditChanged(before, after)).toBe(true);
  });

  it('字幕が未設定と空文字は同じ扱い (触っていないのに戻すボタンを出さない)', () => {
    const before = state([clip('a', 3, {})]);
    const after = state([clip('a', 3, { captionText: '' })]);
    expect(reelEditChanged(before, after)).toBe(false);
  });

  it('字幕の縦位置・繋ぎが変わったら戻せる', () => {
    expect(reelEditChanged(
      state([clip('a', 3, { captionY: 0.78 })]),
      state([clip('a', 3, { captionY: 0.5 })]),
    )).toBe(true);
    expect(reelEditChanged(
      state([clip('a', 3, { transition: 'none' })]),
      state([clip('a', 3, { transition: 'dissolve' })]),
    )).toBe(true);
  });

  it('見た目のプリセット / 色の雰囲気だけが変わっても戻せる (カットは 1 枚も動いていない)', () => {
    expect(reelEditChanged(state([clip('a')], null), state([clip('a')], 'warm'))).toBe(true);
    expect(reelEditChanged(state([clip('a')], null, 'none'), state([clip('a')], null, 'film'))).toBe(true);
  });

  it('カットが 0 枚どうしなら変わっていない', () => {
    expect(reelEditChanged(state([]), state([]))).toBe(false);
  });

  it('0 枚から増えたら戻せる (「3 シーン作って」の取り消し)', () => {
    expect(reelEditChanged(state([]), state([clip('a'), clip('b'), clip('c')]))).toBe(true);
  });
});

describe('スナックバーの一行 (undoLabelFromSummaries)', () => {
  it('要約をそのまま出す', () => {
    expect(undoLabelFromSummaries(['カット 2 を消しました'])).toBe('カット 2 を消しました');
  });

  it('複数の要約は中黒でつなぐ', () => {
    expect(undoLabelFromSummaries(['見た目を暖かくしました', '全体を 15 秒にしました']))
      .toBe('見た目を暖かくしました・全体を 15 秒にしました');
  });

  it('要約が無い時は、していないことを書かない当たりさわりのない一行にする', () => {
    expect(undoLabelFromSummaries([])).toBe('編集しました');
    expect(undoLabelFromSummaries(['', '   '])).toBe('編集しました');
  });

  it('長すぎる時は切って、親指の位置で画面を埋めない', () => {
    const long = undoLabelFromSummaries(['あ'.repeat(120)]);
    expect(long.length).toBe(UNDO_LABEL_MAX);
    expect(long.endsWith('…')).toBe(true);
  });

  it('ちょうど上限までは切らない', () => {
    const exact = 'あ'.repeat(UNDO_LABEL_MAX);
    expect(undoLabelFromSummaries([exact])).toBe(exact);
  });
});
