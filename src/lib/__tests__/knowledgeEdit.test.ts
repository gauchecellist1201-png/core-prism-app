import { describe, it, expect } from 'vitest';
import type { KnowledgeItem } from '../../types/identity';
import { applyKnowledgeEdit, canEditBody, chunkText, inferTags } from '../knowledgeEdit';

const NOW = '2026-09-01T09:00:00.000Z';

function item(over: Partial<KnowledgeItem> & { id: string }): KnowledgeItem {
  return {
    personaId: 'ceo',
    title: 'もとの見出し',
    content: 'もとの本文です。',
    chunks: chunkText('もとの本文です。'),
    sourceType: 'note',
    createdAt: '2026-08-01T00:00:00.000Z',
    tags: [],
    ...over,
  } as KnowledgeItem;
}

describe('applyKnowledgeEdit — 見出し', () => {
  it('見出しを直すと、本文と chunks はそのまま', () => {
    const before = item({ id: 'a' });
    const res = applyKnowledgeEdit(before, { title: '新しい見出し' }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.changed).toBe(true);
    expect(res.item.title).toBe('新しい見出し');
    expect(res.item.content).toBe(before.content);
    expect(res.item.chunks).toBe(before.chunks);
    expect(res.item.updatedAt).toBe(NOW);
  });

  it('元の item は書き換えない', () => {
    const before = item({ id: 'a' });
    applyKnowledgeEdit(before, { title: '別の見出し', content: '別の本文' }, NOW);
    expect(before.title).toBe('もとの見出し');
    expect(before.content).toBe('もとの本文です。');
  });

  it('空の見出し（空白だけ）は通さない', () => {
    const res = applyKnowledgeEdit(item({ id: 'a' }), { title: '   ' }, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('見出し');
  });

  it('前後の空白は落として保存する', () => {
    const res = applyKnowledgeEdit(item({ id: 'a' }), { title: '  詰めた見出し  ' }, NOW);
    expect(res.ok && res.item.title).toBe('詰めた見出し');
  });

  it('何も変わっていない時は changed:false（保存を起こさない）', () => {
    const before = item({ id: 'a' });
    const res = applyKnowledgeEdit(before, { title: before.title, content: before.content }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.changed).toBe(false);
    expect(res.item).toBe(before);
    expect(res.item.updatedAt).toBeUndefined();
  });
});

describe('applyKnowledgeEdit — 本文', () => {
  it('本文を直したら chunks を必ず作り直す（AI が古い文章を読み続けないこと）', () => {
    const before = item({ id: 'a', content: '古い話。' });
    const res = applyKnowledgeEdit(before, { title: before.title, content: '新しい話。ここが本文。' }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const joined = res.item.chunks.map(c => c.content).join('');
    expect(joined).toContain('新しい話');
    expect(joined).not.toContain('古い話');
  });

  it('本文を直したらタグも引き直す', () => {
    const before = item({ id: 'a', content: 'ただのメモ', tags: [] });
    const res = applyKnowledgeEdit(before, { title: before.title, content: '来期の売上と利益の見込みをまとめた。' }, NOW);
    expect(res.ok && res.item.tags).toContain('財務');
  });

  it('要約は消さずに「古い印」を立てる', () => {
    const before = item({
      id: 'a',
      analysis: { summary: '前の要約', insights: [], strategy: [], actions: [], risks: [] } as unknown as KnowledgeItem['analysis'],
    });
    const res = applyKnowledgeEdit(before, { title: before.title, content: 'すっかり書き換えた本文。' }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.analysis?.summary).toBe('前の要約');
    expect(res.item.analysisStale).toBe(true);
  });

  it('要約がまだ無いものには古い印を立てない（出す物が無いのに警告だけ出さない）', () => {
    const res = applyKnowledgeEdit(item({ id: 'a' }), { title: 'まま', content: '書き換えた本文。' }, NOW);
    expect(res.ok && res.item.analysisStale).toBeUndefined();
  });

  it('見出しだけ直した時は、要約に古い印を立てない', () => {
    const before = item({
      id: 'a',
      analysis: { summary: '前の要約', insights: [], strategy: [], actions: [], risks: [] } as unknown as KnowledgeItem['analysis'],
    });
    const res = applyKnowledgeEdit(before, { title: '見出しだけ変更' }, NOW);
    expect(res.ok && res.item.analysisStale).toBeUndefined();
  });

  it('本文を空にする書き換えは通さない（消したい時は削除を使う）', () => {
    const res = applyKnowledgeEdit(item({ id: 'a' }), { title: 'ある', content: '  \n ' }, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('削除');
  });

  it('取り込んだ資料の本文は書き換えさせない', () => {
    const file = item({ id: 'a', sourceType: 'file', fileName: '事業計画.pdf' });
    const res = applyKnowledgeEdit(file, { title: '新しい見出し', content: '差し替え' }, NOW);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toContain('見出しだけ');
  });

  it('取り込んだ資料でも、見出しだけなら直せる', () => {
    const file = item({ id: 'a', sourceType: 'file' });
    const res = applyKnowledgeEdit(file, { title: '4月の事業計画' }, NOW);
    expect(res.ok && res.item.title).toBe('4月の事業計画');
  });
});

describe('applyKnowledgeEdit — 触っていないものを落とさない', () => {
  it('画像・取込バッチ・作成日時・人格はそのまま残る', () => {
    const before = item({
      id: 'a',
      imageBase64: 'data:image/png;base64,AAAA',
      batchId: 'batch-1',
      personaId: 'artist' as KnowledgeItem['personaId'],
    });
    const res = applyKnowledgeEdit(before, { title: '新見出し', content: '新本文。' }, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.imageBase64).toBe('data:image/png;base64,AAAA');
    expect(res.item.batchId).toBe('batch-1');
    expect(res.item.createdAt).toBe(before.createdAt);
    expect(res.item.personaId).toBe(before.personaId);
    expect(res.item.id).toBe('a');
  });
});

describe('canEditBody', () => {
  it('自分で書いたもの（メモ・URL・自動）は本文まで直せる', () => {
    expect(canEditBody(item({ id: 'a', sourceType: 'note' }))).toBe(true);
    expect(canEditBody(item({ id: 'b', sourceType: 'url' }))).toBe(true);
    expect(canEditBody(item({ id: 'c', sourceType: 'auto' }))).toBe(true);
  });
  it('取り込んだファイルは本文を直せない', () => {
    expect(canEditBody(item({ id: 'd', sourceType: 'file' }))).toBe(false);
  });
});

describe('chunkText / inferTags（取り込み時と同じ物を使っていること）', () => {
  it('長い文章は複数チャンクに割れる', () => {
    const long = 'これは長い文章です。'.repeat(80);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.content.length <= 500)).toBe(true);
  });
  it('空文字はチャンク0件', () => {
    expect(chunkText('   ')).toHaveLength(0);
  });
  it('タグは最大4件', () => {
    const tags = inferTags('患者の治療と物件の賃料と楽器の演奏と売上と会議と契約とAIと予定');
    expect(tags.length).toBeLessThanOrEqual(4);
  });
});
