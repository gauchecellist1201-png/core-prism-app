import type { Persona } from '../types/identity';

/**
 * 人格ごとの「指示書」(persona.instructions) をシステムプロンプトへ注入する共通ブロック。
 * CLAUDE.md をナレッジに入れる代用運用を公式機能化 (児玉さんFB 2026-07-21)。
 * AI会話 (useClaude)・提案 (proactiveAgent)・ナレッジ分析/活用 (analyzeKnowledge)・
 * 実行 (actionExecutor) など、その人格で動く AI すべてに常時挿入する。
 */
export function personaInstructionBlock(persona: Pick<Persona, 'instructions'> | null | undefined): string {
  const text = persona?.instructions?.trim();
  if (!text) return '';
  return `\n\n## オーナーからの指示書 (この人格では必ず守る)\n${text}`;
}
