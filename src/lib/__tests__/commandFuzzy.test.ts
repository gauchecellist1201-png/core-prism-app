import { describe, it, expect } from 'vitest';
import { bigrams, fuzzyScore, FUZZY_MIN_SCORE } from '../commandFuzzy';

/** 実際のコマンドバーに並んでいるラベル (抜粋) */
const LABELS = [
  '+ 新規議事録',
  '+ 新規請求書',
  '+ 新規経費',
  '議事録 AI を開く',
  '請求書スタジオ',
  '書類スタジオ',
  '画像生成を開く',
  'スライド生成を開く',
  '売上台帳を開く',
  '今日のレポート',
  '経費 / OCR',
  '人物カルテ / 1on1',
  'テーマ切替',
];

/** 画面と同じ手順で「もしかして？」候補を 3 件まで選ぶ */
function suggest(query: string): string[] {
  return LABELS
    .map(l => ({ l, score: fuzzyScore(query, l) }))
    .filter(x => x.score >= FUZZY_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.l);
}

describe('bigrams', () => {
  it('隣り合う 2 文字を重複なしで返す', () => {
    expect(bigrams('議事録')).toEqual(['議事', '事録']);
  });
  it('空白をまたぐかたまりは捨てる', () => {
    expect(bigrams('売上 台帳')).toEqual(['売上', '台帳']);
  });
  it('1 文字だけの入力では候補を作らない', () => {
    expect(bigrams('あ')).toEqual([]);
  });
  it('大文字小文字を区別しない', () => {
    expect(bigrams('AI')).toEqual(['ai']);
  });
});

describe('打ち間違えた時に、近いものが出る', () => {
  it.each([
    ['議事六', '議事録 AI を開く'],
    ['請求所', '請求書スタジオ'],
    ['画象生成', '画像生成を開く'],
    ['売上大帳', '売上台帳を開く'],
    ['スライドせいせい', 'スライド生成を開く'],
  ])('「%s」→ 候補に「%s」が出る', (q, expected) => {
    expect(suggest(q)).toContain(expected);
  });
});

describe('当たらない言葉では、見当違いの候補を出さない', () => {
  // 1 文字の重なりも数えていた頃は、ここが「今日のレポート」「人物カルテ / 1on1」を返していた
  it.each(['ぁぁぁ', 'xyz123', '経日', 'すらいど', 'zzzz'])('「%s」は 0 件', (q) => {
    expect(suggest(q)).toEqual([]);
  });
});

describe('fuzzyScore', () => {
  it('重なったかたまりの数だけ点が増える', () => {
    expect(fuzzyScore('請球書スタジオ', '請求書スタジオ')).toBeGreaterThan(
      fuzzyScore('請球書スタジオ', '書類スタジオ'),
    );
  });
  it('1 文字しか重ならないものは 0 点 (= 出さない)', () => {
    expect(fuzzyScore('経日', '今日のレポート')).toBe(0);
  });
});
