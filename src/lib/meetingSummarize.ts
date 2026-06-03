// ============================================================
// meetingSummarize — Zoom / Google Meet 会議録画を AI 要約 → ナレッジ化
//
// オーナー指示 (2026-06-03):
//   会議を要約してナレッジに集約 → 提案に活用
//
// 対応する入力:
//   - .vtt / .srt (字幕ファイル) — そのまま要約可
//   - .mp4 / .m4a (音声/動画) — /api/ai で文字起こし→要約
//
// 出力:
//   KnowledgeItem として保存 (sourceType: 'auto', tags: ['会議'])
//   analysis に決定事項 / ActionItem / Risk / Insight を構造化
// ============================================================
import { enqueueClaudeCall } from './apiQueue';
import type { KnowledgeAnalysis } from '../types/identity';

export type MeetingSource = 'zoom' | 'meet' | 'teams' | 'unknown';

export interface MeetingSummary {
  title: string;
  date: string;             // ISO
  source: MeetingSource;
  durationMinutes?: number;
  participants: string[];
  analysis: KnowledgeAnalysis;
  // 会議特有
  keyDecisions: string[];
  actionItems: Array<{ text: string; owner?: string; due?: string }>;
  openQuestions: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

/** .vtt / .srt をプレーンテキストにする */
export function stripCaptions(raw: string): string {
  return raw
    .replace(/^WEBVTT.*$/m, '')
    .replace(/^\d+$/gm, '')                  // SRT のシーケンス番号
    .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3} --> \d{2}:\d{2}:\d{2}[.,]\d{3}.*$/gm, '')
    .replace(/<[^>]+>/g, '')                 // <c.color> 等のタグ
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

/** ファイル名から会議タイトルを推定 */
export function guessTitle(fileName: string): string {
  return fileName
    .replace(/\.(mp4|m4a|vtt|srt|webm|mov)$/i, '')
    .replace(/^GMT\d+_/i, '')                // Zoom 録画の prefix を除去
    .replace(/^Recording[-_ ]?\d*_?/i, '')
    .replace(/_/g, ' ')
    .trim() || '会議録画';
}

/** ファイル名 / メタから source を推定 */
export function guessSource(fileName: string): MeetingSource {
  const f = fileName.toLowerCase();
  if (/zoom|gmt\d/.test(f)) return 'zoom';
  if (/meet|google/.test(f)) return 'meet';
  if (/teams|msft/.test(f)) return 'teams';
  return 'unknown';
}

// ── AI 要約 ────────────────────────────────────────
const SYSTEM = `あなたは会議録音を読み解いて「明日からの動き」に変える事業 AI です。
以下の文字起こしから JSON を 1 つだけ返してください (前後説明なし)。

【スキーマ】
{
  "oneLineSummary": "会議の核心を 1 文で (40 字以内)",
  "summary": "3-5 文の要約",
  "participants": ["田中部長", "佐藤"],
  "keyDecisions": ["決定事項を箇条書き (3-7 個)"],
  "actionItems": [
    { "text": "誰が何をいつまでに", "owner": "オーナー名 (省略可)", "due": "期日 (省略可)" }
  ],
  "openQuestions": ["残った論点 (0-5 個)"],
  "risks": [
    "言及されたリスク (重要度順に書く。法的/財務/事業継続 が上、軽い注意は下)"
  ],
  "insights": ["将来の意思決定に効きそうな気付き (2-5 個)"],
  "strategy": ["戦略提案 (1-3 個)"],
  "actions": ["actionItems と同じ内容を 1 行に短縮 (タスク登録用)"],
  "sentiment": "positive | neutral | negative | mixed"
}

【ルール】
- 文字起こしに無いことは絶対に作らない (嘘禁止)
- 不明なら null か 空配列 を使う
- 日本語のやさしい言葉。横文字は最小限
- risks は致命度の高い順 (違法/訴訟/倒産 → 売上低下 → 注意 → 参考)`;

export async function summarizeMeeting(opts: {
  transcript: string;        // 文字起こし or 字幕本文
  fileName?: string;
  source?: MeetingSource;
  date?: string;
  model?: string;
}): Promise<MeetingSummary> {
  const transcript = opts.transcript.trim();
  if (transcript.length < 50) {
    throw new Error('文字起こしが短すぎます。録画ファイルか字幕をご確認ください。');
  }
  const fileName = opts.fileName || '会議録画';
  const source = opts.source || guessSource(fileName);
  const date = opts.date || new Date().toISOString();
  const title = guessTitle(fileName);

  // 12000 文字を超える長い会議は前後を中心に切り出す (60 分 ≒ 7000-9000 文字目安)
  const truncated = transcript.length > 18000
    ? transcript.slice(0, 9000) + '\n\n…(中略)…\n\n' + transcript.slice(-9000)
    : transcript;

  const userPrompt = `【会議タイトル】${title}\n【ソース】${source}\n【日時】${date}\n\n【文字起こし】\n${truncated}`;

  return enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || 'claude-haiku-4-5',
        max_tokens: 2800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `要約 API ${res.status}`);
    }
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(m ? m[0] : text);
    } catch {
      throw new Error('AI の返答を読み取れませんでした');
    }
    const arr = (k: string): string[] => {
      const v = parsed[k];
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
      return [];
    };
    const sentimentRaw = String(parsed.sentiment || 'neutral');
    const sentiment: MeetingSummary['sentiment'] =
      sentimentRaw === 'positive' || sentimentRaw === 'negative' || sentimentRaw === 'mixed'
        ? sentimentRaw : 'neutral';
    const actionItemsRaw = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
    const actionItems = actionItemsRaw
      .filter((a): a is { text?: unknown; owner?: unknown; due?: unknown } => !!a && typeof a === 'object')
      .map((a) => ({
        text: String(a.text || '').trim(),
        owner: a.owner ? String(a.owner) : undefined,
        due: a.due ? String(a.due) : undefined,
      }))
      .filter(a => a.text);

    const analysis: KnowledgeAnalysis = {
      summary: String(parsed.summary || parsed.oneLineSummary || '').slice(0, 800),
      insights: arr('insights'),
      strategy: arr('strategy'),
      actions: arr('actions').length > 0 ? arr('actions') : actionItems.map(a => a.text),
      risks: arr('risks'),
      generatedAt: new Date().toISOString(),
    };

    return {
      title,
      date,
      source,
      participants: arr('participants'),
      analysis,
      keyDecisions: arr('keyDecisions'),
      actionItems,
      openQuestions: arr('openQuestions'),
      sentiment,
    };
  });
}

/** 会議要約 → KnowledgeItem 風オブジェクトに変換 (呼び出し側で persona / id を付与) */
export function meetingToKnowledgeShape(summary: MeetingSummary, fullText: string) {
  return {
    title: summary.title,
    content: fullText,
    sourceType: 'auto' as const,
    tags: ['会議', `会議:${summary.source}`,
      ...summary.participants.slice(0, 3).map(p => `参加:${p}`),
    ],
    analysis: summary.analysis,
    // 拡張メタ (UI 側で表示)
    meetingMeta: {
      date: summary.date,
      participants: summary.participants,
      keyDecisions: summary.keyDecisions,
      actionItems: summary.actionItems,
      openQuestions: summary.openQuestions,
      sentiment: summary.sentiment,
      source: summary.source,
    },
  };
}
