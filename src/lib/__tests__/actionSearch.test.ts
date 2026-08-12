import { describe, it, expect } from 'vitest';
import { normalizeText, nearScore, searchActions } from '../actionSearch';

const ACTIONS = [
  { id: 'invoice', label: '請求書', desc: '発行して送る' },
  { id: 'youtube', label: '動画で学ぶ', desc: 'YouTube を要約' },
  { id: 'sales', label: '売上を記録', desc: '今日の売上' },
  { id: 'health', label: 'カラダ', desc: '睡眠と活動' },
];
const KEYWORDS: Record<string, string> = {
  invoice: '請求書 インボイス 発行 せいきゅうしょ',
  youtube: '動画 ユーチューブ どうが',
  sales: '売上 うりあげ',
  health: '体調 健康 けんこう',
};

describe('normalizeText — 書き方の違いを吸収する', () => {
  it('カタカナはひらがなとして扱う', () => {
    expect(normalizeText('インボイス')).toBe('いんぼいす');
  });
  it('全角英数字と大文字は小文字の半角になる', () => {
    expect(normalizeText('ＰＤＦ')).toBe('pdf');
  });
  it('空白や句読点は無視する', () => {
    expect(normalizeText('売上 ・ 記録')).toBe('売上記録');
  });
});

describe('searchActions — 変換前のひらがなでも当たる', () => {
  it('漢字に変換する前の「せいきゅうしょ」で請求書が出る', () => {
    const r = searchActions(ACTIONS, 'せいきゅうしょ', KEYWORDS);
    expect(r.hits.map(a => a.id)).toEqual(['invoice']);
  });
  it('カタカナで打っても当たる (インボイス)', () => {
    expect(searchActions(ACTIONS, 'インボイス', KEYWORDS).hits.map(a => a.id)).toEqual(['invoice']);
  });
  it('ひらがなで打っても当たる (いんぼいす)', () => {
    expect(searchActions(ACTIONS, 'いんぼいす', KEYWORDS).hits.map(a => a.id)).toEqual(['invoice']);
  });
  it('説明文の言葉でも当たる', () => {
    expect(searchActions(ACTIONS, '睡眠', KEYWORDS).hits.map(a => a.id)).toEqual(['health']);
  });
  it('空の検索語では全部返る', () => {
    expect(searchActions(ACTIONS, '   ', KEYWORDS).hits).toHaveLength(4);
  });
});

describe('searchActions — 0 件でも行き止まりにしない', () => {
  it('打ち間違い「請求所」でも請求書を提案する', () => {
    const r = searchActions(ACTIONS, '請求所', KEYWORDS);
    expect(r.hits).toHaveLength(0);
    expect(r.near.map(a => a.id)).toContain('invoice');
  });
  it('「せいきゅうしょう」のような打ちすぎでも提案する', () => {
    const r = searchActions(ACTIONS, 'せいきゅうしょう', KEYWORDS);
    expect(r.near.map(a => a.id)).toContain('invoice');
  });
  it('提案は多くても 3 つまで', () => {
    const r = searchActions(ACTIONS, '請求所', KEYWORDS);
    expect(r.near.length).toBeLessThanOrEqual(3);
  });
  it('まったく関係ない言葉なら提案は空 (呼び出し側がよく使う 3 つを出す)', () => {
    const r = searchActions(ACTIONS, 'zzzzz', KEYWORDS);
    expect(r.hits).toHaveLength(0);
    expect(r.near).toHaveLength(0);
  });
  it('言葉の途中で重なっただけのものは提案しない (「どうが」に「体調」を出さない)', () => {
    const only = [{ id: 'health', label: '体調を確認', desc: '睡眠と活動' }];
    const r = searchActions(only, 'どうが', { health: 'たいちょう けんこう かつどう' });
    expect(r.hits).toHaveLength(0);
    expect(r.near).toHaveLength(0);
  });
  it('当たった時は提案を出さない (二重に出さない)', () => {
    expect(searchActions(ACTIONS, '売上', KEYWORDS).near).toHaveLength(0);
  });
});

describe('nearScore — 近さの目安 (言葉の書き出しで測る)', () => {
  it('同じ書き出しで全部合っていれば 1', () => {
    expect(nearScore('請求書', ['請求書', '発行'])).toBe(1);
  });
  it('かすりもしなければ 0', () => {
    expect(nearScore('あいう', ['請求書'])).toBe(0);
  });
  it('言葉の途中で重なっただけなら 0 (「どうが」は「かつどう」に近くない)', () => {
    expect(nearScore('どうが', ['たいちょう', 'かつどう', 'けんこう'])).toBe(0);
  });
  it('3 文字中 2 文字が書き出しから合っていれば 2/3', () => {
    expect(nearScore('請求所', ['請求書', '発行'])).toBeCloseTo(2 / 3, 5);
  });
});
