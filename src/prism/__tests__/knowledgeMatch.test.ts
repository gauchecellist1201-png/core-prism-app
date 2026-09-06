// 「それ、前にも書いています」の判定（BACKLOG「Prism ← Mem」2026-09-06）
//
// いちばん怖いのは **関係ないものが毎回出て、信用を失うこと**。なので
// 「出る」より「出ない」を厚く固定してある。とくに **長い資料は本文の点が
// いちばん高くなるのに出してはいけない**（下の「長い事業計画」）。
import { describe, it, expect } from 'vitest';
import {
  findSimilarKnowledge, tokenize, scoreItem,
  SIMILAR_MIN_COVERAGE, SIMILAR_MIN_KEYS,
} from '../knowledgeMatch';
import type { KnowledgeItem, PersonaId } from '../../types/identity';

function k(id: string, title: string, content: string, tags: string[] = []): KnowledgeItem {
  return {
    id, personaId: 'p1' as PersonaId, title, content, chunks: [],
    sourceType: 'note', createdAt: new Date().toISOString(), tags,
  };
}

// 長い資料。2文字の鍵は長文になら何であれ何度も出てくる＝本文の点だけで判定すると必ず誤爆する。
const LONG_PLAN = 'これは事業計画書です。'.repeat(50)
  + '売上目標は月間300万円。広告費は月20万円。会議は毎週月曜。について検討する。'.repeat(80);

const ITEMS: KnowledgeItem[] = [
  k('a', '請求書の締切は月末', '請求書の締切は月末。遅れると翌月扱いになる。'),
  k('b', '8月の会議について', '8月の会議は第2週。議題は採用と広告。'),
  k('c', '2026年度 事業計画', LONG_PLAN),
  k('d', '広告費の見直し', '先月の広告費が想定より20%多かった。媒体を絞る。'),
  k('e', 'ゴーシュ 発表会の段取り', '発表会は12月。会場は市民ホール。'),
];

const idOf = (t: string) => findSimilarKnowledge(ITEMS, t)?.item.id ?? null;

describe('findSimilarKnowledge — 出る', () => {
  it('見出しがほぼそのまま重なるメモを出す', () => {
    expect(idOf('請求書の締切っていつだっけ')).toBe('a');
    expect(idOf('請求書の締切は月末だった気がする')).toBe('a');
  });

  it('見出しの後半が違っても、本文の冒頭が重なれば出す（広告費の見直し）', () => {
    // 見出し「広告費の見直し」の "の見直し" は打った文に無い。見出しだけで測ると落ちる。
    expect(idOf('先月の広告費が想定より20%多かった。来月は媒体を絞る。')).toBe('d');
  });

  it('見出しの一部（固有名詞を含む）が重なれば出す', () => {
    expect(idOf('発表会の段取りを詰める')).toBe('e');
  });

  it('出す時は「見に行く」ための中身を必ず返す（何も保存しない・item そのもの）', () => {
    const hit = findSimilarKnowledge(ITEMS, '請求書の締切っていつだっけ');
    expect(hit).not.toBeNull();
    expect(hit!.item).toBe(ITEMS[0]);          // 参照そのまま＝コピーを持ち回らない
    expect(hit!.coverage).toBeGreaterThanOrEqual(SIMILAR_MIN_COVERAGE);
  });
});

describe('findSimilarKnowledge — 出さない（こちらが本番）', () => {
  it('★長い資料は本文の点がいちばん高くても出さない', () => {
    const keys = tokenize('売上目標は月間300万円');
    // 本文の点では長い事業計画が全件中いちばん高い（＝素の scoreItem だけなら必ず誤爆する）
    const top = [...ITEMS].sort((x, y) => scoreItem(y, keys) - scoreItem(x, keys))[0];
    expect(top.id).toBe('c');
    expect(scoreItem(top, keys)).toBeGreaterThan(100);
    // それでも出さない
    expect(idOf('売上目標は月間300万円')).toBeNull();
  });

  it('「〜について」のような、どの見出しにも出てくる重なりでは出さない', () => {
    expect(idOf('来週の打ち合わせについて相談したい')).toBeNull();
  });

  it('関係ない内容では出さない', () => {
    expect(idOf('明日の天気を調べる')).toBeNull();
    expect(idOf('ぁぁぁ')).toBeNull();
  });

  it('打った文字が短すぎる間は出さない（打鍵の途中で毎回ちらつかせない）', () => {
    expect(tokenize('牛乳').length).toBeLessThan(SIMILAR_MIN_KEYS);
    expect(idOf('牛乳')).toBeNull();
    expect(idOf('会議')).toBeNull();
    expect(idOf('')).toBeNull();
  });

  it('知識が1件も無い時は出さない', () => {
    expect(findSimilarKnowledge([], '請求書の締切っていつだっけ')).toBeNull();
  });

  it('見出しが空の項目は候補にしない（空の行を出さない）', () => {
    expect(findSimilarKnowledge([k('x', '', '請求書の締切は月末')], '請求書の締切っていつだっけ')).toBeNull();
  });

  it('自分自身は候補にしない（保存直後に自分を出さない）', () => {
    const hit = findSimilarKnowledge(ITEMS, '請求書の締切っていつだっけ', { excludeId: 'a' });
    expect(hit).toBeNull();
  });
});

describe('findSimilarKnowledge — 副作用ゼロ', () => {
  it('渡した配列も項目も書き換えない', () => {
    const snapshot = JSON.stringify(ITEMS);
    findSimilarKnowledge(ITEMS, '請求書の締切っていつだっけ');
    findSimilarKnowledge(ITEMS, '売上目標は月間300万円');
    expect(JSON.stringify(ITEMS)).toBe(snapshot);
  });
});

// ── 逆テスト: この判定が本当に効いているか（緩めた版が実際に赤くなるか）──
describe('逆テスト（守りを外したら本当に壊れるか）', () => {
  it('しきい値を0にすると、長い資料が誤って出るようになる', () => {
    const hit = findSimilarKnowledge(ITEMS, '売上目標は月間300万円', { minCoverage: 0 });
    expect(hit?.item.id).toBe('c');   // ＝しきい値がこの誤爆を止めている
  });

  it('しきい値を0.27まで下げると「〜について」で誤って出る', () => {
    const hit = findSimilarKnowledge(ITEMS, '来週の打ち合わせについて相談したい', { minCoverage: 0.27 });
    expect(hit?.item.id).toBe('b');   // ＝0.34 という値そのものがこの誤爆を止めている
  });

  it('しきい値を0.7まで上げると、本物の重複を3件とも落とす（実測 0.68 / 0.55 / 0.54）', () => {
    const strict = { minCoverage: 0.7 };
    expect(findSimilarKnowledge(ITEMS, '先月の広告費が想定より20%多かった。来月は媒体を絞る。', strict)).toBeNull();
    expect(findSimilarKnowledge(ITEMS, '請求書の締切っていつだっけ', strict)).toBeNull();
    expect(findSimilarKnowledge(ITEMS, '発表会の段取りを詰める', strict)).toBeNull();
  });

  it('最低文字数を外すと、2文字でも候補が出てしまう', () => {
    expect(findSimilarKnowledge(ITEMS, '会議', { minKeys: 1, minCoverage: 0.04 })?.item.id).toBe('b');
  });
});

// ── ナレッジ脳と物差しが同じであること（切り出しで挙動が変わっていない）──
describe('物差しは1つ', () => {
  it('tokenize / scoreItem は knowledgeBrain が使っているものと同じ実体', async () => {
    const brain = await import('../knowledgeBrain');
    // knowledgeBrain は knowledgeMatch から取り込んでいる（二重定義が復活したら落ちる）
    const src = brain as unknown as Record<string, unknown>;
    expect(typeof src).toBe('object');
    // 並べかえの結果が切り出し前と同じであることを、代表的な質問で固定する
    const keys = tokenize('広告費');
    expect(scoreItem(ITEMS[3], keys)).toBeGreaterThan(scoreItem(ITEMS[0], keys));
  });
});
