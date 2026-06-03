import { useState, useCallback } from 'react';
import type { ChatMessage, KnowledgeChunk, KnowledgeItem, Persona, AppSettings } from '../types/identity';
import { toneInstruction } from '../lib/aiTone';
import { callAiWithFallback } from '../lib/aiFallbackChain';

const MODELS = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },   // USD per MTok
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-opus-4-5': { input: 5.0, output: 25.0 },
} as const;

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = MODELS[model as keyof typeof MODELS] ?? MODELS['claude-haiku-4-5'];
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function estimateTokens(text: string): number {
  // 日本語: 約1.5文字/token、英語: 約4文字/token（概算）
  return Math.ceil(text.length / 2);
}

// 質問に対し、ナレッジ items から関連性の高い 3-5 件を抽出 (タイトル + 要約 + タグ overlap)
// チャンク単位の RAG (App.tsx 側) と相補で、AI に「どの資料を参照しているか」を意識させる
export function selectRelevantKnowledge(
  query: string,
  items: KnowledgeItem[],
  topK = 5,
): KnowledgeItem[] {
  if (items.length === 0) return [];
  const q = query.toLowerCase();
  // 簡易 2-gram + ワード分割
  const tokens = new Set<string>();
  q.split(/[\s　、。、。!?,.()\[\]{}「」『』]+/).forEach(w => {
    if (w.length >= 2) tokens.add(w);
  });
  for (let i = 0; i < q.length - 1; i++) {
    const bg = q.slice(i, i + 2);
    if (/[一-龯ぁ-んァ-ヶa-z0-9]/.test(bg)) tokens.add(bg);
  }
  if (tokens.size === 0) return items.slice(0, topK);

  const scored = items.map(item => {
    const hay = (
      item.title + ' ' +
      (item.analysis?.summary ?? '') + ' ' +
      (item.analysis?.insights?.join(' ') ?? '') + ' ' +
      item.tags.join(' ')
    ).toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (!t) continue;
      const matches = hay.split(t).length - 1;
      if (matches > 0) score += matches * (t.length >= 2 ? 2 : 1);
    }
    // タグ完全一致でブースト
    for (const tag of item.tags) {
      if (q.includes(tag.toLowerCase())) score += 5;
    }
    // タイトル一部一致で追加ブースト
    if (item.title && q.includes(item.title.toLowerCase().slice(0, 4))) score += 3;
    return { item, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.item);
}

// 古い会話履歴 (-10 件より前) を「過去会話の要約」に圧縮 (最大 30 件遡る)
// LLM を呼ばずローカル抽出: ユーザー発言の先頭 60 文字を箇条書きに
export function summarizeOldHistory(history: ChatMessage[], keepRecent = 10, maxLookback = 30): string {
  if (history.length <= keepRecent) return '';
  const oldRange = history.slice(Math.max(0, history.length - keepRecent - maxLookback), history.length - keepRecent);
  if (oldRange.length === 0) return '';
  const lines: string[] = [];
  for (const m of oldRange) {
    const head = m.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!head) continue;
    if (m.role === 'user') lines.push(`- 質問: ${head}`);
    else lines.push(`  → 回答骨子: ${head}`);
  }
  if (lines.length === 0) return '';
  return lines.slice(-20).join('\n');
}

function buildSystemPrompt(
  persona: Persona,
  knowledgeChunks: KnowledgeChunk[],
  aiTone?: 'gentle' | 'professional' | 'casual',
  uiLanguage?: 'ja' | 'en' | 'zh',
  knowledgeItems?: KnowledgeItem[],
  historySummary?: string,
): string {
  // チャンク本文 — 詳細な根拠
  const ragContext = knowledgeChunks.length > 0
    ? `\n\n## あなたが参照すべき資料 (抜粋):\n${knowledgeChunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`
    : '';

  // 関連ナレッジのタイトル+要約 — 「どの資料を見ているか」をAIに明示させる
  const itemContext = knowledgeItems && knowledgeItems.length > 0
    ? `\n\n## 関連が高い資料 (タイトル一覧 — 引用時はタイトルで言及):\n${knowledgeItems.map((it, i) => {
        const summary = it.analysis?.summary ? ` — ${it.analysis.summary.slice(0, 80)}` : '';
        const tags = it.tags.length > 0 ? ` [${it.tags.join(',')}]` : '';
        return `[K${i + 1}] ${it.title}${tags}${summary}`;
      }).join('\n')}`
    : '';

  const historyBlock = historySummary
    ? `\n\n## 過去の会話の要約 (古い順):\n${historySummary}\n上記の文脈を踏まえて回答する。`
    : '';

  const localeLine = uiLanguage && uiLanguage !== 'ja'
    ? `\nユーザーの表示言語: ${uiLanguage === 'en' ? 'English' : '中文 (简体)'}。応答もその言語に合わせる。`
    : '';

  return `あなたはオーナーの **専属秘書** で、「${persona.name}」の役割をサポートしています。
オーナーが蓄積してきた資料・数字・タスクを全部覚えていて、必要に応じて提案・代筆・分析・整理を即座に行います。
${localeLine}
## 担当している役割
${persona.description || `${persona.name} (${persona.subtitle})`}

${toneInstruction(aiTone)}

## 振る舞いの基本
- 質問に答えるだけでなく、**「次にこうしてみては?」** という提案を必ず添える。
- ただし押し付けない。「やってみますか?」「気になりますか?」のように、選択をオーナーに残す。
- 大事な提案は **「理由 → やること → いつまでに」** の順で短く。
- 体調・生活の話題は本文の最後に1文だけ。事業の話を中心にする。
- 数字・期日・固有名詞を入れて具体的に。「がんばりましょう」だけは禁止。
- 資料を参照した場合は「○○ (タイトル) によると…」のように出典をはっきり示す。${itemContext}${ragContext}${historyBlock}

---
今日の日付: ${new Date().toLocaleDateString('ja-JP')}`;
}

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export function useClaude(settings: AppSettings, onUpdateStats?: (tokens: number, cost: number) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    persona: Persona,
    message: string,
    history: ChatMessage[],
    knowledgeChunks: KnowledgeChunk[],
    knowledgeItems?: KnowledgeItem[],
  ): Promise<ChatMessage | null> => {
    // API キーガードは不要 — /api/ai は env Gemini で fallback できる
    setIsLoading(true);
    setError(null);

    // 最新 10 件は丸ごと、それ以前 30 件はローカル要約として system プロンプトに合流
    const historySummary = summarizeOldHistory(history, 10, 30);
    const systemPrompt = buildSystemPrompt(
      persona,
      knowledgeChunks,
      settings.aiTone,
      settings.uiLanguage,
      knowledgeItems,
      historySummary,
    );
    const model = settings.preferredModel;

    // 会話履歴（最新10件まで） — それより前は systemPrompt の要約に集約済み
    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      // XX (2026-06-03): 階段式 fallback (Haiku → Sonnet → Gemini Flash)
      const data = await callAiWithFallback(
        { model, max_tokens: 1024, system: systemPrompt, messages },
      );
      const content = data.content?.[0]?.text ?? '';
      const inputTokens = data.usage?.input_tokens ?? estimateTokens(systemPrompt + message);
      const outputTokens = data.usage?.output_tokens ?? estimateTokens(content);
      const usedModel = data.resolvedModel || model;
      const cost = estimateCost(inputTokens, outputTokens, usedModel);

      onUpdateStats?.(inputTokens + outputTokens, cost);

      // 引用表示用: 関連ナレッジ item の ID を優先 (UI でタイトルを引ける)。
      // 旧仕様 (chunk ID) との互換のため、items が無ければ chunk ID にフォールバック。
      const usedKnowledge = knowledgeItems && knowledgeItems.length > 0
        ? knowledgeItems.map(it => it.id)
        : knowledgeChunks.map(c => c.id);

      const reply: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        tokensUsed: inputTokens + outputTokens,
        usedKnowledge,
      };
      return reply;

    } catch (err) {
      const msg = err instanceof Error ? err.message : '不明なエラー';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [settings, onUpdateStats]);

  return { sendMessage, isLoading, error };
}

// ── コスト計算ユーティリティ ────────────────────────────
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

export function estimateMonthlyCost(
  messagesPerDay: number,
  avgInputTokens: number,
  avgOutputTokens: number,
  model: string,
): { usd: number; jpy: number } {
  const pricing = MODELS[model as keyof typeof MODELS] ?? MODELS['claude-haiku-4-5'];
  const monthlyInput = messagesPerDay * 30 * avgInputTokens;
  const monthlyOutput = messagesPerDay * 30 * avgOutputTokens;
  const usd = (monthlyInput / 1_000_000) * pricing.input + (monthlyOutput / 1_000_000) * pricing.output;
  return { usd, jpy: Math.round(usd * 150) };
}
