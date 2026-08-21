import { describe, it, expect } from 'vitest';
import {
  previewBody,
  buildKnowledgeResult,
  buildSuggestionResult,
  nextSuggestionStatus,
  formatTakenInDate,
  INLINE_BODY_MAX,
} from '../inlineCommandResult';

describe('previewBody — 切っていない時に「切った」と言わない', () => {
  it('空/ 空白だけなら本文を作らない', () => {
    expect(previewBody(undefined)).toEqual({ truncated: false });
    expect(previewBody('')).toEqual({ truncated: false });
    expect(previewBody('   \n\n  ')).toEqual({ truncated: false });
  });

  it('上限以内なら 1 文字も触らず truncated は立たない', () => {
    const text = 'あ'.repeat(INLINE_BODY_MAX);
    const r = previewBody(text);
    expect(r.body).toBe(text);
    expect(r.truncated).toBe(false);
  });

  it('上限を超えた時だけ切って、切ったことを立てる', () => {
    const text = 'あ'.repeat(INLINE_BODY_MAX + 1);
    const r = previewBody(text);
    expect(r.body).toHaveLength(INLINE_BODY_MAX);
    expect(r.truncated).toBe(true);
  });

  it('途中の改行は残す (箇条書きが 1 行に潰れると読めない)', () => {
    expect(previewBody('  ・A\n・B  ').body).toBe('・A\n・B');
  });
});

describe('formatTakenInDate — 読めない日付を Invalid Date のまま出さない', () => {
  it('読めない値は null', () => {
    expect(formatTakenInDate(undefined)).toBeNull();
    expect(formatTakenInDate('いつか')).toBeNull();
  });
  it('読める値だけ日本語の日付にする', () => {
    expect(formatTakenInDate('2026-08-14T01:00:00.000Z')).toMatch(/月.*日/);
  });
});

describe('buildKnowledgeResult — 画面を移らずに読める札', () => {
  const base = {
    id: 'k1',
    title: '取引先ヒアリングメモ',
    content: '相手は月末が忙しい。\n次は 9/3 に持っていく。',
    fileKind: 'text',
    tags: ['営業', '面談', '9月', '4つ目は出さない'],
    createdAt: '2026-08-14T01:00:00.000Z',
  };

  it('本文をそのまま渡し、コピー用の全文も持つ', () => {
    const r = buildKnowledgeResult(base);
    expect(r.id).toBe('knowledge:k1');
    expect(r.title).toBe('取引先ヒアリングメモ');
    expect(r.body).toBe('相手は月末が忙しい。\n次は 9/3 に持っていく。');
    expect(r.copyText).toBe(r.body);
    expect(r.truncated).toBe(false);
    expect(r.emptyReason).toBeUndefined();
  });

  it('添え書きは種類・取り込み日・タグ 3 件まで', () => {
    const r = buildKnowledgeResult(base);
    expect(r.meta).toContain('テキスト');
    expect(r.meta).toContain('に取り込み');
    expect(r.meta).toContain('営業 · 面談 · 9月');
    expect(r.meta).not.toContain('4つ目は出さない');
  });

  it('長い資料は切って、切ったことを立て、コピーは全文のまま', () => {
    const long = 'ほ'.repeat(INLINE_BODY_MAX + 500);
    const r = buildKnowledgeResult({ ...base, content: long });
    expect(r.body).toHaveLength(INLINE_BODY_MAX);
    expect(r.truncated).toBe(true);
    expect(r.copyText).toHaveLength(long.length); // 切る前の全文
  });

  it('読める文字が無い資料は、無いと言い切る (中身があるように見せない)', () => {
    const r = buildKnowledgeResult({ ...base, content: '', fileKind: 'image' });
    expect(r.body).toBeUndefined();
    expect(r.copyText).toBeUndefined();
    expect(r.emptyReason).toContain('画像');
  });

  it('画像以外で中身が無い時も、それらしい本文を作らない', () => {
    const r = buildKnowledgeResult({ ...base, content: '   ', fileKind: 'pdf' });
    expect(r.body).toBeUndefined();
    expect(r.emptyReason).toContain('読み取れる文字');
  });

  it('「この画面を開く」は渡された時だけ持つ (勝手に行き先を作らない)', () => {
    expect(buildKnowledgeResult(base).open).toBeUndefined();
    let went = 0;
    const r = buildKnowledgeResult(base, { label: 'ナレッジ画面で開く', run: () => { went += 1; } });
    expect(r.open?.label).toBe('ナレッジ画面で開く');
    r.open?.run();
    expect(went).toBe(1);
  });

  it('種類も日付もタグも無い資料では、添え書きを作らない', () => {
    const r = buildKnowledgeResult({ id: 'k2', title: 'メモ', content: 'a' });
    expect(r.meta).toBeUndefined();
  });
});

describe('nextSuggestionStatus — 採用 ⇄ 未判定 を必ず行き来する', () => {
  it('採用なら未判定へ、それ以外なら採用へ', () => {
    expect(nextSuggestionStatus('adopted')).toBe('pending');
    expect(nextSuggestionStatus('pending')).toBe('adopted');
    expect(nextSuggestionStatus('rejected')).toBe('adopted');
    expect(nextSuggestionStatus(undefined)).toBe('adopted');
  });

  it('2 回続けて押すと必ず元へ戻る (同じ側へ倒れ続けない)', () => {
    const a = nextSuggestionStatus('pending');
    expect(nextSuggestionStatus(a)).toBe('pending');
  });
});

describe('buildSuggestionResult — 書けた時だけ「変えました」と言う', () => {
  const s = { id: 's1', title: '広告費を来月まで止める', detail: '理由:\n先月の反応が 0 件。', cxoName: 'CFO' };

  it('読み直した値が狙いどおりの時だけ、変えたと書く', () => {
    const r = buildSuggestionResult({ suggestion: s, wanted: 'adopted', after: 'adopted' });
    expect(r.id).toBe('suggestion:s1');
    expect(r.meta).toContain('「採用」に変えました');
    expect(r.emptyReason).toBeUndefined();
    expect(r.body).toBe('理由:\n先月の反応が 0 件。');
    expect(r.copyText).toBe(r.body);
  });

  it('保存が黙って落ちた時 (値が変わっていない) は、変えたと言わない', () => {
    const r = buildSuggestionResult({ suggestion: s, wanted: 'adopted', after: 'pending' });
    expect(r.meta).toContain('変えられませんでした');
    expect(r.emptyReason).toContain('「未判定」のまま');
    expect(r.emptyReason).toContain('保存できませんでした');
  });

  it('履歴から消えていた時は、その事実を書く (勝手に成功にしない)', () => {
    const r = buildSuggestionResult({ suggestion: s, wanted: 'pending', after: undefined });
    expect(r.meta).toContain('変えられませんでした');
    expect(r.emptyReason).toContain('履歴に残っていない');
  });

  it('詳細が無い提案でも、それらしい本文を作らない', () => {
    const r = buildSuggestionResult({ suggestion: { id: 's2', title: 'あ' }, wanted: 'adopted', after: 'adopted' });
    expect(r.body).toBeUndefined();
    expect(r.copyText).toBeUndefined();
    expect(r.meta).toBe('提案 · 「採用」に変えました');
  });

  it('長い詳細は切って、切ったことを立てる', () => {
    const long = 'ん'.repeat(INLINE_BODY_MAX + 10);
    const r = buildSuggestionResult({ suggestion: { ...s, detail: long }, wanted: 'adopted', after: 'adopted' });
    expect(r.body).toHaveLength(INLINE_BODY_MAX);
    expect(r.truncated).toBe(true);
    expect(r.copyText).toHaveLength(long.length);
  });
});
