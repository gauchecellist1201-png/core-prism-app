import { useState, useCallback } from 'react';
import type { ChatMessage, KnowledgeChunk, Persona, AppSettings } from '../types/identity';

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

function buildSystemPrompt(persona: Persona, knowledgeChunks: KnowledgeChunk[]): string {
  const ragContext = knowledgeChunks.length > 0
    ? `\n\n## あなたが参照すべきナレッジベース（RAG）:\n${knowledgeChunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`
    : '';

  return `あなたはオーナーの**専属秘書 (Chief of Staff)** であり、「${persona.name}」人格のブレインです。
オーナーの全資料・全数値・全タスク・全人格を把握しており、必要に応じて戦略立案・意思決定・文書作成・分析・代筆を即時に行います。

## 担当人格について:
${persona.description || `${persona.name}（${persona.subtitle}）`}

## 振る舞い:
- 質問への回答だけでなく、**踏み込んだ提案**と**次の一手**を毎回提示する
- 数値・期日・固有名詞で具体化し、抽象論を避ける
- 重要な打ち手は理由 → 行動 → 期日 の順で簡潔に
- 健康・生活面の話題は要点を1文に圧縮し、本筋(事業/戦略)を中心に据える
- 日本語。簡潔・断定的に。秘書は迷わない${ragContext}

---
今日の日付: ${new Date().toLocaleDateString('ja-JP')}`;
}

// 環境変数のAPIキーを優先し、なければsettingsのキーを使う
function getApiKey(settings: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
}

export function useClaude(settings: AppSettings, onUpdateStats?: (tokens: number, cost: number) => void) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    persona: Persona,
    message: string,
    history: ChatMessage[],
    knowledgeChunks: KnowledgeChunk[],
  ): Promise<ChatMessage | null> => {
    const apiKey = getApiKey(settings);
    if (!apiKey) {
      setError('Claude APIキーが設定されていません。設定画面で入力してください。');
      return null;
    }

    setIsLoading(true);
    setError(null);

    const systemPrompt = buildSystemPrompt(persona, knowledgeChunks);
    const model = settings.preferredModel;

    // 会話履歴（最新10件まで）
    const messages = [
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? `APIエラー: ${res.status}`);
      }

      const data = await res.json();
      const content = data.content?.[0]?.text ?? '';
      const inputTokens = data.usage?.input_tokens ?? estimateTokens(systemPrompt + message);
      const outputTokens = data.usage?.output_tokens ?? estimateTokens(content);
      const cost = estimateCost(inputTokens, outputTokens, model);

      onUpdateStats?.(inputTokens + outputTokens, cost);

      const reply: ChatMessage = {
        role: 'assistant',
        content,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        tokensUsed: inputTokens + outputTokens,
        usedKnowledge: knowledgeChunks.map(c => c.id),
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

// ── コスト計算ユーティリティ ──────────────────────────────
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
