import { describe, it, expect } from 'vitest';
import { toReading, isKanaPart, readingHit, kataToHira } from '../commandReading';
import { rankScore, matchScore, compareRanked } from '../commandScore';
import { fuzzyScore, FUZZY_MIN_SCORE } from '../commandFuzzy';

/**
 * 画面と同じ形で並べ替える (CommandPalette の filtered と同じ手順)。
 * `withReading` を false にすると **この機能が無かった頃**の振る舞いになる = 逆テスト用。
 */
function rank(
  items: Array<{ label: string; subtitle?: string; count?: number }>,
  query: string,
  withReading = true,
): string[] {
  const parts = query.trim().toLowerCase().split(/\s+/);
  const scored = items
    .map(it => ({
      it,
      score: rankScore(
        it.label,
        it.subtitle,
        parts,
        it.count,
        withReading ? toReading(it.label + ' ' + (it.subtitle ?? '')) : undefined,
      ),
      count: it.count ?? 0,
    }))
    .filter((x): x is { it: typeof items[number]; score: number; count: number } => x.score !== null);
  scored.sort(compareRanked);
  return scored.map(s => s.it.label);
}

/** 実際の画面に出ている項目 (CommandPalette の MODAL_LIST から抜粋) */
const ITEMS = [
  { label: '売上台帳', subtitle: '日次の売上を記録' },
  { label: '請求書スタジオ', subtitle: '発行・入金管理' },
  { label: '議事録 AI を開く', subtitle: '会議の音声を要約' },
  { label: '画像生成を開く', subtitle: 'OG 画像・アイキャッチ' },
  { label: '今日のレポート', subtitle: '売上・AI 完了・明日の 3 手を 1 枚で' },
  { label: 'P&L 損益計算書', subtitle: '今月の損益を見る' },
  { label: '人物カルテ / 1on1', subtitle: '関係者を記録' },
  { label: '設定を開く', subtitle: 'すべての設定 (5 タブ + 検索)' },
];

describe('読みがなを作る', () => {
  it('辞書にある語はひらがなの読みになる', () => {
    expect(toReading('売上台帳')).toBe('うりあげだいちょう');
    expect(toReading('請求書スタジオ')).toBe('せいきゅうしょすたじお');
    expect(toReading('議事録')).toBe('ぎじろく');
  });

  it('長い語から先に当てるので「損益計算書」が「損益」+「計算書」に割れない', () => {
    expect(toReading('損益計算書')).toBe('そんえきけいさんしょ');
  });

  it('カタカナはひらがなに、長音符はそのまま', () => {
    expect(kataToHira('レポート')).toBe('れぽーと');
    expect(toReading('今日のレポート')).toBe('きょうのれぽーと');
  });

  it('辞書に無い漢字はそのまま残す (かなのクエリと重ならないので害が無い)', () => {
    expect(toReading('鰻の蒲焼')).toBe('鰻の蒲焼');
  });
});

describe('かなで打っている語かどうか', () => {
  it('ひらがな・カタカナ 2 文字以上だけを「かな」とみなす', () => {
    expect(isKanaPart('うりあげ')).toBe(true);
    expect(isKanaPart('ウリアゲ')).toBe(true);
    expect(isKanaPart('れぽーと')).toBe(true);
  });

  it('1 文字は当たりすぎるので「かな」とみなさない', () => {
    // 「か」で読みに当てると、ほぼ全部の項目が出てしまう
    expect(isKanaPart('か')).toBe(false);
    expect(readingHit('か', 'うりあげだいちょう')).toBe(false);
  });

  it('漢字・英数まじりは読みの側に当てにいかない (書いてある文字で判定する)', () => {
    expect(isKanaPart('売上')).toBe(false);
    expect(isKanaPart('ai')).toBe(false);
  });
});

describe('IME で変換する前でもコマンドが出る (この項目の狙い)', () => {
  it('「うりあげ」で売上台帳が出る', () => {
    expect(rank(ITEMS, 'うりあげ')).toContain('売上台帳');
  });

  it('【逆テスト】読みがなを渡さないと「うりあげ」は 1 件も出ない (事故当時の作り)', () => {
    expect(rank(ITEMS, 'うりあげ', false)).toEqual([]);
  });

  it('「せいきゅうしょ」で請求書スタジオが出る', () => {
    expect(rank(ITEMS, 'せいきゅうしょ')).toContain('請求書スタジオ');
    expect(rank(ITEMS, 'せいきゅうしょ', false)).toEqual([]);
  });

  it('「ぎじろく」「がぞう」「そんえき」でもそれぞれ出る', () => {
    expect(rank(ITEMS, 'ぎじろく')).toContain('議事録 AI を開く');
    expect(rank(ITEMS, 'がぞう')).toContain('画像生成を開く');
    expect(rank(ITEMS, 'そんえき')).toContain('P&L 損益計算書');
  });

  it('カタカナで打っても拾う (ウリアゲ)', () => {
    expect(rank(ITEMS, 'ウリアゲ')).toContain('売上台帳');
  });

  it('説明文の側の読みでも当たる (「にっぽう」など画面に無い語は当たらない)', () => {
    // 「きろく」はラベルには無く、説明文「日次の売上を記録」にだけある
    expect(rank(ITEMS, 'きろく')).toContain('売上台帳');
    expect(rank(ITEMS, 'にっぽう')).toEqual([]);
  });
});

describe('書いてある文字での当たり方を 1 点も壊していない', () => {
  it('漢字で打った時の点数は、読みを渡しても渡さなくても同じ', () => {
    const parts = ['売上'];
    expect(matchScore('売上台帳', '日次の売上を記録', parts, toReading('売上台帳 日次の売上を記録')))
      .toBe(matchScore('売上台帳', '日次の売上を記録', parts));
  });

  it('漢字で打った時の並びは今までどおり', () => {
    expect(rank(ITEMS, '売上')).toEqual(rank(ITEMS, '売上', false));
  });

  it('読みでだけ当たったものは、書いてある文字で当たったものを追い抜かない', () => {
    const items = [
      // 「きろく」が読みでしか当たらない側
      { label: '売上台帳', subtitle: '日次の売上を記録' },
      // ラベルにそのまま「きろく」と書いてある側 (先頭一致)
      { label: 'きろく帳', subtitle: '' },
    ];
    expect(rank(items, 'きろく')[0]).toBe('きろく帳');
  });

  it('読みの加点は 1 点 = いちばん弱い扱い', () => {
    const reading = toReading('売上台帳 日次の売上を記録');
    expect(matchScore('売上台帳', '日次の売上を記録', ['うりあげ'], reading)).toBe(1);
  });
});

describe('もしかして？候補もかなで出る (打ち間違いの回収)', () => {
  const hay = '請求書スタジオ 発行・入金管理';
  const reading = toReading(hay);

  it('かなの打ち間違い「せいきゆうしよ」でも候補になる', () => {
    expect(fuzzyScore('せいきゆうしよ', hay, reading)).toBeGreaterThanOrEqual(FUZZY_MIN_SCORE);
  });

  it('【逆テスト】読みを渡さなければ 0 = 候補が一生出ない (事故当時の作り)', () => {
    expect(fuzzyScore('せいきゆうしよ', hay)).toBe(0);
  });

  it('当たらない言葉は読みを渡しても 0 のまま (見当違いを増やさない)', () => {
    expect(fuzzyScore('ぁぁぁ', hay, reading)).toBe(0);
    expect(fuzzyScore('xyz123', hay, reading)).toBe(0);
    expect(fuzzyScore('zzzz', hay, reading)).toBe(0);
  });

  it('漢字で打った時の点数は今までと同じ', () => {
    expect(fuzzyScore('請求所', hay, reading)).toBe(fuzzyScore('請求所', hay));
  });
});

describe('正直に・当たらないものは当たらないままにしてある', () => {
  it('辞書に無い動的な項目 (ナレッジのタイトル等) はかなでは当たらない', () => {
    const dynamic = [{ label: '鰻屋の常連台帳', subtitle: '' }];
    // 「だいちょう」は辞書にあるので当たるが、「うなぎ」は辞書に無いので当たらない
    expect(rank(dynamic, 'だいちょう')).toEqual(['鰻屋の常連台帳']);
    expect(rank(dynamic, 'うなぎ')).toEqual([]);
  });
});
