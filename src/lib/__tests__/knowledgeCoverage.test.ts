import { describe, it, expect } from 'vitest';
import { isNoKnowledgeMatch, NO_KNOWLEDGE_MATCH_TEXT } from '../knowledgeCoverage';

describe('isNoKnowledgeMatch — 「今の資料には無かった」を言う条件', () => {
  it('資料は持っているのに、抜粋も関連資料も0件なら言う', () => {
    expect(isNoKnowledgeMatch({
      totalKnowledgeCount: 12, relevantChunkCount: 0, relevantItemCount: 0,
    })).toBe(true);
  });

  it('まだ資料を1件も入れていない人には言わない（毎回出て意味が薄れる）', () => {
    expect(isNoKnowledgeMatch({
      totalKnowledgeCount: 0, relevantChunkCount: 0, relevantItemCount: 0,
    })).toBe(false);
  });

  it('関連資料が1件でも渡っていれば言わない（出典チップと食い違わせない）', () => {
    expect(isNoKnowledgeMatch({
      totalKnowledgeCount: 12, relevantChunkCount: 0, relevantItemCount: 1,
    })).toBe(false);
  });

  it('抜粋が1件でも渡っていれば言わない', () => {
    expect(isNoKnowledgeMatch({
      totalKnowledgeCount: 12, relevantChunkCount: 3, relevantItemCount: 0,
    })).toBe(false);
  });

  it('件数が数値でない/欠けている場合は言わない（フェイルオープン＝黙って注記しない）', () => {
    expect(isNoKnowledgeMatch({
      totalKnowledgeCount: Number.NaN, relevantChunkCount: 0, relevantItemCount: 0,
    })).toBe(false);
  });

  it('文言は1種類・警告の言葉を使わず、答えを止めないと分かる書き方', () => {
    expect(NO_KNOWLEDGE_MATCH_TEXT).toContain('一般的な内容でお答えします');
    expect(NO_KNOWLEDGE_MATCH_TEXT).not.toMatch(/エラー|警告|失敗|できません/);
  });
});
