import { describe, it, expect } from 'vitest';
import {
  REEL_OUT_W, REEL_DESTINATIONS, getReelDestination,
  REEL_SAFE_TOP, REEL_SAFE_BOTTOM,
  wrapCaptionLines, captionBox, captionHiddenSide, safeCaptionY,
} from '../reelSafeArea';

describe('出し先ごとの形', () => {
  it('幅は全部の出し先で 1080 のまま（字幕の大きさが出し先ごとに変わらないため）', () => {
    expect(REEL_OUT_W).toBe(1080);
  });

  it('3つの出し先が、名乗っている比率どおりの高さになっている', () => {
    const byId = Object.fromEntries(REEL_DESTINATIONS.map(d => [d.id, d]));
    expect(byId.reel.h).toBe(1920);            // 1080:1920 = 9:16
    expect(byId.feed.h).toBe(1350);            // 1080:1350 = 4:5
    expect(byId.square.h).toBe(1080);          // 1:1
    expect(REEL_OUT_W / byId.reel.h).toBeCloseTo(9 / 16, 5);
    expect(REEL_OUT_W / byId.feed.h).toBeCloseTo(4 / 5, 5);
    expect(REEL_OUT_W / byId.square.h).toBeCloseTo(1, 5);
  });

  it('どの出し先も推奨の 1080 幅を下回らない（粗い動画を出荷しない）', () => {
    REEL_DESTINATIONS.forEach(d => {
      expect(REEL_OUT_W).toBeGreaterThanOrEqual(1080);
      expect(d.h).toBeGreaterThanOrEqual(1080);
    });
  });

  it('知らない id を渡しても落ちず、既定のリールに戻る', () => {
    expect(getReelDestination('reel').id).toBe('reel');
    expect(getReelDestination('nope' as never).id).toBe('reel');
  });

  it('アプリの部品が乗るのは 9:16 だけ（フィードに嘘の警告を出さない）', () => {
    expect(getReelDestination('reel').hasOverlay).toBe(true);
    expect(getReelDestination('feed').hasOverlay).toBe(false);
    expect(getReelDestination('square').hasOverlay).toBe(false);
  });
});

describe('字幕の折り返し', () => {
  it('14文字を超えて区切り文字が来たところで折り返す', () => {
    expect(wrapCaptionLines('こんにちは')).toEqual(['こんにちは']);
    const l = wrapCaptionLines('あいうえおかきくけこさしすせそ。たちつてとなにぬねのはひふへほ。');
    expect(l.length).toBe(2);
    expect(l[0].endsWith('。')).toBe(true);
  });

  it('空文字は 0 行（存在しない行を数えない）', () => {
    expect(wrapCaptionLines('')).toEqual([]);
  });
});

describe('隠れる帯の判定', () => {
  const base = { fontSize: 56, outH: 1920, hasOverlay: true };

  it('既定の位置 (0.78) と既定の文字サイズ (56) の字幕は、下のボタンに隠れている＝これが元の壊れ方', () => {
    // 0.78 × 1920 = 1497.6 が字幕の中心。1行 56px なら下端は約 1531。
    // 隠れる帯の上端は 1920 × (1 - 0.22) = 1497.6 なので、はっきり食い込んでいる。
    expect(captionHiddenSide({ ...base, text: 'この夏いちばん盛れる場所', yRatio: 0.78 })).toBe('bottom');
  });

  it('真ん中に置けば隠れない', () => {
    expect(captionHiddenSide({ ...base, text: 'この夏いちばん盛れる場所', yRatio: 0.5 })).toBe(null);
  });

  it('上に寄せすぎると、上のプロフィール名に隠れる', () => {
    expect(captionHiddenSide({ ...base, text: 'この夏いちばん盛れる場所', yRatio: 0.1 })).toBe('top');
  });

  it('フィード（4:5・1:1）では隠れる帯が無いので、警告を出さない', () => {
    expect(captionHiddenSide({ ...base, hasOverlay: false, text: 'あ', yRatio: 0.95 })).toBe(null);
    expect(captionHiddenSide({ ...base, hasOverlay: false, outH: 1350, text: 'あ', yRatio: 0.9 })).toBe(null);
  });

  it('字幕が空なら警告を出さない（何も書いていない人を脅かさない）', () => {
    expect(captionHiddenSide({ ...base, text: '   ', yRatio: 0.95 })).toBe(null);
  });

  it('行数が増えると上へ伸びるので、同じ位置でも隠れ方が変わる', () => {
    const long = 'あいうえおかきくけこさしすせそ。たちつてとなにぬねのはひふへほ。まみむめもやゆよらり。';
    const one = captionBox({ text: 'ひとこと', yRatio: 0.5, fontSize: 64, outH: 1920 });
    const many = captionBox({ text: long, yRatio: 0.5, fontSize: 64, outH: 1920 });
    expect(many.lines).toBeGreaterThan(one.lines);
    expect(many.top).toBeLessThan(one.top);
    expect(many.bottom).toBeGreaterThan(one.bottom);
  });
});

describe('安全な位置へ動かす', () => {
  const mk = (yRatio: number, text = 'この夏いちばん盛れる場所') =>
    ({ text, yRatio, fontSize: 56, outH: 1920 });

  it('動かした後は、必ず隠れなくなる', () => {
    [0.95, 0.9, 0.78, 0.12, 0.1].forEach(y => {
      const moved = safeCaptionY(mk(y));
      expect(captionHiddenSide({ ...mk(y), yRatio: moved, hasOverlay: true })).toBe(null);
    });
  });

  it('もともと隠れていない字幕は 1px も動かさない（人が決めた位置を勝手に変えない）', () => {
    expect(safeCaptionY(mk(0.5))).toBeCloseTo(0.5, 6);
    expect(safeCaptionY(mk(0.35))).toBeCloseTo(0.35, 6);
  });

  it('スライダーで触れる範囲 (0.1〜0.95) の外へは出さない', () => {
    const y = safeCaptionY(mk(0.99));
    expect(y).toBeGreaterThanOrEqual(0.1);
    expect(y).toBeLessThanOrEqual(0.95);
  });

  it('安全な帯より字幕のほうが背が高い時は中央に置く（文字を削らない）', () => {
    const huge = { text: 'あ', yRatio: 0.9, fontSize: 3000, outH: 1920 };
    expect(safeCaptionY(huge)).toBeCloseTo(0.5, 6);
  });

  it('安全な帯の目安が 0〜1 の割合で、上下を合わせても画面を食い尽くさない', () => {
    expect(REEL_SAFE_TOP).toBeGreaterThan(0);
    expect(REEL_SAFE_BOTTOM).toBeGreaterThan(0);
    expect(REEL_SAFE_TOP + REEL_SAFE_BOTTOM).toBeLessThan(0.5);
  });
});
