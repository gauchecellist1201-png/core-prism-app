// ============================================================
// onAccent — 「アクセント色の面に乗る文字」が必ず読めることを固定する
//
// 2026-08-09 の事故: 主ボタンが全画面で
//   `background: persona.accentColor, color: '#0a0a0f'`
// で固定されており、Prism のブランド紫 #9333EA では 3.67:1 しか出ていなかった。
// 「ここを黒に戻す」変更が入ったら、このテストが落ちる。
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { onAccent, onAccentInk, onAccentGradient, darkSafeFace, contrast } from '../accentFace';

const AA = 4.5;

/**
 * ペルソナ色はソースから拾う＝**あとから足された色も自動で検査対象になる**。
 * 一覧をテストに手書きすると、新しいペルソナを足した人がここを更新し忘れて
 * 「テストは緑なのに読めないボタンが増える」が起きる。
 */
function collectAccentColorsFromSource(): string[] {
  const root = join(__dirname, '../..');
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/accentColor:\s*'(#[0-9a-fA-F]{6})'/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(root);
  return [...found];
}

/** 実際に画面で使われているアクセント色。増えたらここに足す。 */
const CXO_COLORS = [
  '#FBBF24', '#60A5FA', '#A78BFA', '#F472B6', '#FB923C', '#34D399', '#10B981',
  '#9CA3AF', '#06B6D4', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6',
];
/** オンボーディングで作られるペルソナ（デモの音楽スクールは #9333EA） */
const ONBOARDING_COLORS = ['#c9a96e', '#9333EA'];
/** 画面に直書きされている色 */
const LITERAL_COLORS = ['#f87171', '#34D399', '#7C3AED', '#DC2626', '#6B7280', '#8E5CFF'];

const SOURCE_COLORS = collectAccentColorsFromSource();
const ALL = [...new Set([...SOURCE_COLORS, ...CXO_COLORS, ...ONBOARDING_COLORS, ...LITERAL_COLORS])];

describe('onAccent', () => {
  it('実際に使われている全アクセント色で、面と文字が AA(4.5) 以上になる', () => {
    const bad: string[] = [];
    for (const c of ALL) {
      const { background, color } = onAccent(c);
      const ratio = contrast(background, color);
      if (ratio < AA) bad.push(`${c} -> ${background}/${color} = ${ratio.toFixed(2)}`);
    }
    expect(bad).toEqual([]);
  });

  it('黒が通っている明るいアクセントは、これまで通り黒のまま（見た目を変えない）', () => {
    // 黄・緑・水色・桃 は元から 7〜11 通っていた。ここが白に変わると全画面の印象が変わる。
    for (const c of ['#FBBF24', '#34D399', '#06B6D4', '#F472B6', '#FB923C', '#60A5FA']) {
      expect(onAccent(c)).toEqual({ background: c, color: '#0a0a0f' });
    }
  });

  it('黒が落ちていた色は白文字になる（面はブランド色のまま）', () => {
    for (const c of ['#9333EA', '#7C3AED', '#DC2626', '#6B7280']) {
      const r = onAccent(c);
      expect(r.color).toBe('#FFFFFF');
      expect(r.background).toBe(c); // 面は変えない＝ブランド色が濁らない
      expect(contrast(r.background, r.color)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('黒でも白でも届かない中間色(#6366F1)は、面のほうをずらして届かせる', () => {
    // 元の #6366F1 は 黒 4.42 / 白 4.47 でどちらも AA 未満。
    expect(contrast('#6366F1', '#0a0a0f')).toBeLessThan(AA);
    expect(contrast('#6366F1', '#FFFFFF')).toBeLessThan(AA);
    const r = onAccent('#6366F1');
    expect(r.background).not.toBe('#6366F1');
    // hover の brightness(1.08) 分の余白まで持たせる
    expect(contrast(r.background, r.color)).toBeGreaterThanOrEqual(5.0);
  });

  it('hex で書かれていない色は判定をあきらめ、これまでの黒のまま返す（面を壊さない）', () => {
    for (const c of ['var(--accent)', 'rgba(1,2,3,0.5)', 'linear-gradient(90deg, #fff, #000)']) {
      expect(onAccent(c)).toEqual({ background: c, color: '#0a0a0f' });
    }
  });

  it('onAccentInk は onAccent と同じ文字色を返す（チェック印など面と離れた場所用）', () => {
    for (const c of ALL) expect(onAccentInk(c)).toBe(onAccent(c).color);
  });
});

describe('onAccentGradient', () => {
  it('グラデの両端どちらでも AA を満たす', () => {
    const bad: string[] = [];
    for (const c of ALL) {
      const { background, color } = onAccentGradient(c);
      const stops = background.match(/#[0-9a-fA-F]{6}/g) ?? [];
      expect(stops.length).toBeGreaterThanOrEqual(2);
      for (const s of stops) {
        const ratio = contrast(s, color);
        if (ratio < AA) bad.push(`${c} stop ${s}/${color} = ${ratio.toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('旧実装の `${accent}cc` 終端は面の中でいちばん薄い所を作っていた（回帰の目印）', () => {
    // 終端に透過を使わず、文字と反対側へずらしていることを固定する。
    const { background } = onAccentGradient('#34D399');
    expect(background).not.toContain('cc)');
    expect(background).not.toMatch(/#34D399[0-9a-f]{2}/i);
  });
});

describe('darkSafeFace', () => {
  it('黒文字が落ちる色だけを、色みを変えずに明るくする', () => {
    // 音楽スクールLPの主CTA: 紫→金。紫の側だけ黒が 3.67 で落ちていた。
    expect(contrast('#9333EA', '#0a0a0f')).toBeLessThan(AA);
    const fixed = darkSafeFace('#9333EA');
    expect(fixed).not.toBe('#9333EA');
    expect(contrast(fixed, '#0a0a0f')).toBeGreaterThanOrEqual(AA);
    // 金は元から 11.8 通っているので触らない＝ブランドの格を落とさない
    expect(darkSafeFace('#FBBF24')).toBe('#FBBF24');
  });
});
