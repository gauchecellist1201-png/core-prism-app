// ============================================================
// YouTube → AI 要約・ナレッジ化ユーティリティ
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';

export interface VideoMeta {
  videoId: string;
  url: string;
  title: string;
  author: string;
  thumbnailUrl: string;
}

export interface YouTubeSummary {
  summary: string;
  chapters: Array<{ title: string; content: string }>;
  quotes: string[];
  actions: string[];
}

/** YouTube URL から videoId を抽出 */
export function parseYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    // youtu.be 短縮
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0];
      return id.length === 11 ? id : null;
    }
    // youtube.com/watch?v=
    const v = u.searchParams.get('v');
    if (v && v.length === 11) return v;
    // youtube.com/embed/ or /shorts/
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    // 正規表現フォールバック
    const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/** oEmbed API でタイトル・投稿者・サムネを取得 (CORS OK) */
export async function fetchOEmbed(url: string): Promise<VideoMeta> {
  const videoId = parseYouTubeUrl(url);
  if (!videoId) throw new Error('YouTube URLを正しく入力してください');

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error(`oEmbed取得失敗: ${res.status}`);
  const data = await res.json();

  return {
    videoId,
    url,
    title: data.title ?? 'YouTube動画',
    author: data.author_name ?? '',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * 字幕テキストの取得を試みる。
 * ブラウザからは CORS 制約のため多くのエンドポイントが失敗するので null 返却して
 * 呼び出し側で手動入力 UI にフォールバックする。
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  // Vercel Edge Function 経由で字幕を取得 (CORS 回避)
  try {
    const res = await fetch(`/api/youtube/transcript?v=${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !data.transcript) return null;
    return typeof data.transcript === 'string' && data.transcript.length > 50 ? data.transcript : null;
  } catch {
    return null;
  }
}

/** Claude に要約・章立て・引用・アクションを依頼 */
export async function summarizeWithClaude(
  settings: AppSettings,
  transcript: string,
  meta: VideoMeta,
): Promise<YouTubeSummary> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || settings.claudeApiKey || '';
  if (!apiKey) throw new Error('Claude APIキーが設定されていません。環境設定で入力してください。');

  const SYSTEM = `あなたは動画コンテンツを構造化してナレッジ化する専門家です。
提供された字幕・テキストを分析し、以下の JSON を返してください。

{
  "summary": "3〜5行の要約",
  "chapters": [
    { "title": "章タイトル", "content": "その章の要点 (2〜3行)" }
  ],
  "quotes": ["印象的な引用や重要フレーズ (最大5件)"],
  "actions": ["視聴者が取れる具体的なアクション (最大5件)"]
}

- chaptersは内容に応じて3〜7章
- 日本語で回答
- JSONのみ返す (前後のコードブロック記号不要)`;

  const userPrompt = `## 動画タイトル\n${meta.title}\n## チャンネル\n${meta.author}\n## URL\n${meta.url}\n\n## 字幕 / テキスト\n${transcript.slice(0, 15000)}`;

  return enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `API エラー: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI の応答を解析できませんでした');
    return JSON.parse(jsonMatch[0]) as YouTubeSummary;
  });
}
